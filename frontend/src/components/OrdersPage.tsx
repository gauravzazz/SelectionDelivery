import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Order, OrderService, OrderSource } from '../api/orderApi';
import { fetchShippingQuote, QuoteResponse, createShipment, cancelShipment, getShipmentLabel } from '../api/shippingApi';
import CourierModal from './CourierModal';
import OrderDetailModal from './OrderDetailModal';
import {
    addHoursIso,
    buildNextFollowUpAt,
    getOrderFollowUpHours,
    isFollowUpActive,
    readFollowUpHours,
    sanitizeFollowUpHours,
    writeFollowUpHours,
} from '../engine/followupScheduler';
import './OrdersPage.css';

const SWIPE_ACTION_WIDTH = 108;
const SWIPE_OPEN_THRESHOLD = 54;
const SWIPE_DELETE_THRESHOLD = 144;
const SWIPE_MAX_OFFSET = 172;
const ORDER_SOURCES: OrderSource[] = ['pdf2printout', 'onlineprintout.com'];

function getSourceLabel(source?: OrderSource): string {
    if (source === 'pdf2printout') return 'pdf2printout';
    if (source === 'onlineprintout.com') return 'onlineprintout.com';
    return 'Not set';
}

interface SwipeableDraftCardProps {
    onOpen: () => void;
    onDelete: () => void;
    children: React.ReactNode;
}

const SwipeableDraftCard: React.FC<SwipeableDraftCardProps> = ({ onOpen, onDelete, children }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [dragging, setDragging] = useState(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const startOffsetRef = useRef(0);
    const suppressClickRef = useRef(false);
    const horizontalLockRef = useRef<boolean | null>(null);

    const finishSwipe = () => {
        if (!dragging) return;
        setDragging(false);

        const dragDistance = Math.abs(offsetX);
        if (dragDistance >= SWIPE_DELETE_THRESHOLD) {
            setOffsetX(-SWIPE_ACTION_WIDTH);
            onDelete();
            return;
        }

        if (dragDistance >= SWIPE_OPEN_THRESHOLD) {
            setOffsetX(-SWIPE_ACTION_WIDTH);
        } else {
            setOffsetX(0);
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        startOffsetRef.current = offsetX;
        suppressClickRef.current = false;
        horizontalLockRef.current = null;
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging) return;

        const dx = e.clientX - startXRef.current;
        const dy = e.clientY - startYRef.current;

        if (horizontalLockRef.current === null) {
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            horizontalLockRef.current = Math.abs(dx) >= Math.abs(dy);
        }

        if (!horizontalLockRef.current) return;
        if (Math.abs(dx) > 6) suppressClickRef.current = true;

        const next = Math.min(0, Math.max(-SWIPE_MAX_OFFSET, startOffsetRef.current + dx));
        setOffsetX(next);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        finishSwipe();
    };

    const handlePointerCancel = () => {
        finishSwipe();
    };

    const handleSurfaceClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }

        if (Math.abs(offsetX) > 2) {
            setOffsetX(0);
            return;
        }

        onOpen();
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOffsetX(0);
        onDelete();
    };

    return (
        <div className={`swipe-draft-wrapper ${dragging ? 'dragging' : ''}`}>
            <button type="button" className="swipe-delete-action" onClick={handleDeleteClick}>
                Delete
            </button>
            <div
                className="swipe-draft-surface"
                style={{ transform: `translateX(${offsetX}px)` }}
                onClick={handleSurfaceClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                {children}
            </div>
        </div>
    );
};

const OrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Shipping confirmation state
    const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
    const [shippingQuotes, setShippingQuotes] = useState<QuoteResponse | null>(null);
    const [showShipModal, setShowShipModal] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<QuoteResponse['allOptions'][0] | null>(null);
    const [shippingLoading, setShippingLoading] = useState(false);

    // Manual Confirm State
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [trackForm, setTrackForm] = useState({ trackingId: '', trackingCourier: '', trackingLink: '' });
    const [followUpHours, setFollowUpHours] = useState<number>(() => readFollowUpHours());
    const [followUpActionOrderId, setFollowUpActionOrderId] = useState<string | null>(null);
    const [nowTick, setNowTick] = useState<number>(Date.now());
    const [confirmedPincodeFilter, setConfirmedPincodeFilter] = useState('');
    const [confirmedSourceFilter, setConfirmedSourceFilter] = useState<'all' | OrderSource>('all');
    const [sourcePrompt, setSourcePrompt] = useState<{ order: Order; action: 'ship' | 'manual_confirm' } | null>(null);
    const [sourceSelection, setSourceSelection] = useState<OrderSource>('pdf2printout');
    const [savingSource, setSavingSource] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // tracking orderId for cancel/label actions

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await OrderService.getAllOrders();
            const patchesToPersist: Array<{ id: string; patch: Partial<Order> }> = [];
            const normalized = data.map((order) => {
                if (order.status !== 'draft') return order;
                if (!isFollowUpActive(order)) return order;

                const hours = getOrderFollowUpHours(order, followUpHours);
                const nextFollowUpAt = order.nextFollowUpAt || buildNextFollowUpAt(order, followUpHours);

                const patch: Partial<Order> = {};
                if (!order.followUpAfterHours) patch.followUpAfterHours = hours;
                if (!order.nextFollowUpAt) patch.nextFollowUpAt = nextFollowUpAt;
                if (!order.followUpStatus) patch.followUpStatus = 'scheduled';

                if (Object.keys(patch).length > 0) {
                    patchesToPersist.push({ id: order.id, patch });
                }

                return {
                    ...order,
                    followUpAfterHours: order.followUpAfterHours || hours,
                    nextFollowUpAt,
                    followUpStatus: order.followUpStatus || 'scheduled',
                };
            });

            setOrders(normalized);

            patchesToPersist.forEach(({ id, patch }) => {
                OrderService.updateOrder(id, patch).catch((error) => {
                    console.error('Failed to persist follow-up schedule patch', error);
                });
            });
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowTick(Date.now());
        }, 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        writeFollowUpHours(followUpHours);
    }, [followUpHours]);

    const handleOrderClick = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const promptSourceIfMissing = (order: Order, action: 'ship' | 'manual_confirm'): boolean => {
        if (order.orderSource) return false;
        setSourceSelection('pdf2printout');
        setSourcePrompt({ order, action });
        return true;
    };

    const fetchShippingForOrder = async (order: Order) => {
        if (order.paymentStatus !== 'paid') {
            alert('Mark order as paid before creating shipment.');
            return;
        }
        setShippingOrder(order);
        setShippingLoading(true);
        setShippingQuotes(null);
        setSelectedCourier(null);

        try {
            // Use order pincode and weight (fallback if missing)
            const pincode = order.address.pincode;
            const weight = order.weightGrams || 500;

            const quotes = await fetchShippingQuote({
                destinationPincode: pincode,
                weightGrams: weight,
            });
            setShippingQuotes(quotes);

            if (quotes.allOptions.length > 0) {
                const preferred =
                    quotes.allOptions.find((opt) => opt.courierId === order.selectedCourierId) ||
                    quotes.allOptions.find((opt) => opt.courierName === order.courierName) ||
                    quotes.cheapest;
                setSelectedCourier(preferred);
            }
            setShowShipModal(true);
        } catch (err) {
            alert('Failed to fetch shipping rates. Please check pincode.');
            console.error(err);
        } finally {
            setShippingLoading(false);
        }
    };

    const handleShipClick = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation(); // Prevent opening detail modal
        if (order.paymentStatus !== 'paid') {
            alert('Mark order as paid before creating shipment.');
            return;
        }
        if (promptSourceIfMissing(order, 'ship')) return;
        await fetchShippingForOrder(order);
    };

    const handleCreateShipment = async () => {
        if (!shippingOrder || !selectedCourier) return;
        if (promptSourceIfMissing(shippingOrder, 'ship')) {
            setShowShipModal(false);
            return;
        }

        if (!confirm(`Ship via ${selectedCourier.courierName} for ₹${selectedCourier.price}?`)) return;

        try {
            setShippingLoading(true);
            await createShipment(shippingOrder.id, selectedCourier.courierId);
            alert('Shipment created successfully! Tracking ID generated.');
            setShowShipModal(false);
            setShippingOrder(null);
            loadOrders();
        } catch (err) {
            console.error(err);
            alert('Failed to create shipment. Try again.');
        } finally {
            setShippingLoading(false);
        }
    };

    const performConfirm = async (orderId: string) => {
        if (!trackForm.trackingId.trim()) {
            alert('Enter tracking ID');
            return;
        }
        try {
            await OrderService.confirmOrder(orderId, {
                trackingId: trackForm.trackingId,
                trackingCourier: trackForm.trackingCourier,
                trackingLink: trackForm.trackingLink,
            });
            setConfirmingId(null);
            setTrackForm({ trackingId: '', trackingCourier: '', trackingLink: '' });
            loadOrders();
        } catch (err) {
            console.error('Confirm failed:', err);
            alert('Failed to confirm order');
        }
    };

    const handleConfirm = async (order: Order) => {
        if (promptSourceIfMissing(order, 'manual_confirm')) return;
        await performConfirm(order.id);
    };

    const requestDeleteOrder = async (orderId: string) => {
        if (!confirm('Delete this order?')) return;
        try {
            await OrderService.deleteOrder(orderId);
            loadOrders();
            if (selectedOrder?.id === orderId) setIsDetailOpen(false);
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleDelete = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        await requestDeleteOrder(orderId);
    };

    const togglePaymentStatus = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        const nextStatus = order.paymentStatus === 'paid' ? 'pending' : 'paid';
        try {
            const payload: Partial<Order> = {
                paymentStatus: nextStatus,
                stage: nextStatus === 'paid' ? 'paid' : 'awaiting_payment',
            };
            if (nextStatus === 'paid') {
                payload.paidAt = new Date().toISOString();
                payload.followUpStatus = 'done';
                payload.nextFollowUpAt = '';
            } else {
                payload.paidAt = '';
                const nowIso = new Date().toISOString();
                const hours = getOrderFollowUpHours(order, followUpHours);
                payload.followUpAfterHours = hours;
                payload.followUpStatus = 'scheduled';
                payload.nextFollowUpAt = addHoursIso(nowIso, hours);
            }
            await OrderService.updateOrder(order.id, payload);
            await loadOrders();
        } catch (err) {
            console.error('Failed to update payment status', err);
            alert('Failed to update payment status');
        }
    };

    const generateTrackingMessage = (order: Order): string => {
        let msg = `📦 *Order Confirmed!*\n\n`;
        msg += `*Customer*: ${order.address.name}\n`;
        msg += `*Items*: ${order.items.length} book(s)\n`;
        msg += `*Total*: ₹${order.grandTotal}\n\n`;

        if (order.trackingCourier) {
            msg += `*Courier*: ${order.trackingCourier}\n`;
        }
        if (order.trackingId) {
            msg += `*Tracking ID*: ${order.trackingId}\n`;
        }
        if (order.trackingLink) {
            msg += `*Track*: ${order.trackingLink}\n`;
        }

        msg += `\n📌 *Guidelines*:\n`;
        msg += `• Keep the tracking ID for reference\n`;
        msg += `• Expected delivery: 3-5 business days\n`;
        msg += `• Contact us for any issues\n`;

        return msg;
    };

    const shareWhatsApp = (e: React.MouseEvent, text: string, phone?: string) => {
        e.stopPropagation();
        const msg = encodeURIComponent(text);
        if (phone) {
            window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
        } else {
            window.open(`https://wa.me/?text=${msg}`, '_blank');
        }
    };

    const shareTelegram = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        const msg = encodeURIComponent(text);
        window.open(`https://t.me/share/url?url=.&text=${msg}`, '_blank');
    };

    const handleCancelShipment = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to cancel this shipment? The order will be moved back to "Ready to Ship".')) return;

        setActionLoading(orderId);
        try {
            await cancelShipment(orderId);
            alert('Shipment cancelled successfully.');
            loadOrders();
        } catch (err: any) {
            alert(`Failed to cancel: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownloadLabel = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        if (order.labelUrl) {
            window.open(order.labelUrl, '_blank');
            return;
        }

        setActionLoading(order.id);
        try {
            const { labelUrl } = await getShipmentLabel(order.id);
            window.open(labelUrl, '_blank');
        } catch (err: any) {
            alert(`Failed to get label: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const formatRelativeDue = (iso?: string): string => {
        if (!iso) return 'No follow-up time';
        const ts = new Date(iso).getTime();
        if (Number.isNaN(ts)) return 'Invalid follow-up time';

        const diffMs = ts - nowTick;
        const absMinutes = Math.round(Math.abs(diffMs) / 60000);
        const hours = Math.floor(absMinutes / 60);
        const minutes = absMinutes % 60;
        const parts = [
            hours > 0 ? `${hours}h` : '',
            `${minutes}m`,
        ].filter(Boolean).join(' ');

        return diffMs <= 0 ? `${parts} ago` : `in ${parts}`;
    };

    const getReminderMessage = (order: Order): string => {
        const name = order.address.name || 'there';
        return `Hi ${name}, gentle reminder from print shop. Your draft order total is ₹${order.grandTotal}. Reply to confirm and we will process quickly.`;
    };

    const applyOrderPatchLocally = (orderId: string, patch: Partial<Order>) => {
        setOrders((prev) =>
            prev.map((order) =>
                order.id === orderId
                    ? { ...order, ...patch, updatedAt: new Date().toISOString() }
                    : order,
            ),
        );
    };

    const persistOrderPatch = async (orderId: string, patch: Partial<Order>) => {
        await OrderService.updateOrder(orderId, patch);
    };

    const handleSourcePromptCancel = () => {
        if (savingSource) return;
        setSourcePrompt(null);
    };

    const handleSourcePromptSave = async () => {
        if (!sourcePrompt) return;

        const { order, action } = sourcePrompt;
        setSavingSource(true);
        try {
            const patch: Partial<Order> = { orderSource: sourceSelection };
            applyOrderPatchLocally(order.id, patch);
            if (selectedOrder?.id === order.id) {
                setSelectedOrder((prev) => (prev ? { ...prev, ...patch } : prev));
            }
            await persistOrderPatch(order.id, patch);
            setSourcePrompt(null);

            const updatedOrder: Order = { ...order, ...patch };
            if (action === 'ship') {
                await fetchShippingForOrder(updatedOrder);
            } else {
                await performConfirm(updatedOrder.id);
            }
        } catch (error) {
            console.error('Failed to save order source', error);
            alert('Failed to save order source. Please retry.');
            await loadOrders();
        } finally {
            setSavingSource(false);
        }
    };

    const sendFollowUpReminder = async (order: Order, channel: 'whatsapp' | 'telegram') => {
        setFollowUpActionOrderId(order.id);
        try {
            const message = encodeURIComponent(getReminderMessage(order));
            if (channel === 'whatsapp') {
                if (order.address.phone) {
                    window.open(`https://wa.me/91${order.address.phone}?text=${message}`, '_blank');
                } else {
                    window.open(`https://wa.me/?text=${message}`, '_blank');
                }
            } else {
                window.open(`https://t.me/share/url?url=.&text=${message}`, '_blank');
            }

            const nowIso = new Date().toISOString();
            const hours = getOrderFollowUpHours(order, followUpHours);
            const patch: Partial<Order> = {
                followUpAfterHours: hours,
                followUpStatus: 'scheduled',
                lastOutboundMessageAt: nowIso,
                nextFollowUpAt: addHoursIso(nowIso, hours),
                followUpCount: (order.followUpCount || 0) + 1,
            };
            applyOrderPatchLocally(order.id, patch);
            await persistOrderPatch(order.id, patch);
        } catch (error) {
            console.error('Failed to send follow-up reminder', error);
            alert('Failed to schedule follow-up after reminder. Please retry.');
            await loadOrders();
        } finally {
            setFollowUpActionOrderId(null);
        }
    };

    const snoozeFollowUp = async (order: Order, hoursToSnooze: number) => {
        setFollowUpActionOrderId(order.id);
        try {
            const nowIso = new Date().toISOString();
            const safeHours = sanitizeFollowUpHours(hoursToSnooze);
            const patch: Partial<Order> = {
                followUpAfterHours: safeHours,
                followUpStatus: 'snoozed',
                nextFollowUpAt: addHoursIso(nowIso, safeHours),
            };
            applyOrderPatchLocally(order.id, patch);
            await persistOrderPatch(order.id, patch);
        } catch (error) {
            console.error('Failed to snooze follow-up', error);
            alert('Failed to snooze follow-up.');
            await loadOrders();
        } finally {
            setFollowUpActionOrderId(null);
        }
    };

    const markCustomerReplied = async (order: Order) => {
        setFollowUpActionOrderId(order.id);
        try {
            const nowIso = new Date().toISOString();
            const patch: Partial<Order> = {
                followUpStatus: 'done',
                lastCustomerReplyAt: nowIso,
                nextFollowUpAt: '',
            };
            applyOrderPatchLocally(order.id, patch);
            await persistOrderPatch(order.id, patch);
        } catch (error) {
            console.error('Failed to mark customer replied', error);
            alert('Failed to mark as replied.');
            await loadOrders();
        } finally {
            setFollowUpActionOrderId(null);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };



    const drafts = orders.filter(o => o.status === 'draft');
    const confirmed = orders.filter(o => o.status === 'confirmed');
    const filteredConfirmed = useMemo(
        () =>
            confirmed.filter((order) => {
                const sourceOk = confirmedSourceFilter === 'all' || order.orderSource === confirmedSourceFilter;
                const pincodeOk =
                    !confirmedPincodeFilter.trim()
                    || (order.address.pincode || '').includes(confirmedPincodeFilter.trim());
                return sourceOk && pincodeOk;
            }),
        [confirmed, confirmedSourceFilter, confirmedPincodeFilter],
    );
    const confirmedTotals = useMemo(
        () =>
            filteredConfirmed.reduce(
                (acc, order) => {
                    acc.count += 1;
                    acc.grandTotal += Number(order.grandTotal || 0);
                    acc.booksTotal += Number(order.booksTotal || 0);
                    acc.shippingTotal += Number(order.shippingCharge || 0);
                    return acc;
                },
                { count: 0, grandTotal: 0, booksTotal: 0, shippingTotal: 0 },
            ),
        [filteredConfirmed],
    );
    const dueFollowUps = useMemo(
        () =>
            drafts
                .filter((order) => {
                    if (!isFollowUpActive(order)) return false;
                    const next = order.nextFollowUpAt || buildNextFollowUpAt(order, followUpHours);
                    const nextTs = new Date(next).getTime();
                    if (Number.isNaN(nextTs)) return false;
                    return nextTs <= nowTick;
                })
                .sort((a, b) => {
                    const at = new Date(a.nextFollowUpAt || a.updatedAt).getTime();
                    const bt = new Date(b.nextFollowUpAt || b.updatedAt).getTime();
                    return at - bt;
                }),
        [drafts, followUpHours, nowTick],
    );

    if (loading) {
        return (
            <div className="orders-page">
                <h3>📋 Orders</h3>
                <div className="orders-loading">Loading orders...</div>
            </div>
        );
    }

    return (
        <div className="orders-page">
            <div className="orders-header">
                <h3>📋 Orders</h3>
            </div>

            {orders.length === 0 && (
                <div className="orders-empty">
                    <div className="empty-icon">📭</div>
                    <p>No orders yet. Create one from the Cart.</p>
                </div>
            )}

            {drafts.length > 0 && (
                <div className="order-section followup-section">
                    <div className="followup-header-row">
                        <h4 className="section-label followup-label">Follow-up Scheduler</h4>
                        <label className="followup-hours-control" onClick={(e) => e.stopPropagation()}>
                            <span>No reply after</span>
                            <input
                                type="number"
                                min={1}
                                max={72}
                                value={followUpHours}
                                onChange={(e) => setFollowUpHours(sanitizeFollowUpHours(Number(e.target.value) || 1))}
                            />
                            <span>hrs</span>
                        </label>
                    </div>

                    {dueFollowUps.length === 0 ? (
                        <div className="followup-empty glass-panel">
                            No follow-up is due right now.
                        </div>
                    ) : (
                        <div className="followup-task-list">
                            {dueFollowUps.map((order) => {
                                const isBusy = followUpActionOrderId === order.id;
                                const nextDue = order.nextFollowUpAt || buildNextFollowUpAt(order, followUpHours);
                                return (
                                    <div
                                        key={`followup-${order.id}`}
                                        className="followup-task glass-panel"
                                        onClick={() => handleOrderClick(order)}
                                    >
                                        <div className="followup-task-top">
                                            <span className="order-name">{order.address.name || 'No Name'}</span>
                                            <span className="followup-due-chip">Due {formatRelativeDue(nextDue)}</span>
                                        </div>
                                        <div className="followup-task-meta">
                                            <span>📱 {order.address.phone || '—'}</span>
                                            <span>📍 {order.address.pincode || '—'}</span>
                                            <span>₹{order.grandTotal}</span>
                                        </div>
                                        <div className="followup-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="btn-followup whatsapp"
                                                onClick={() => sendFollowUpReminder(order, 'whatsapp')}
                                                disabled={isBusy}
                                            >
                                                {isBusy ? '...' : 'WhatsApp'}
                                            </button>
                                            <button
                                                className="btn-followup telegram"
                                                onClick={() => sendFollowUpReminder(order, 'telegram')}
                                                disabled={isBusy}
                                            >
                                                Telegram
                                            </button>
                                            <button
                                                className="btn-followup snooze"
                                                onClick={() => snoozeFollowUp(order, followUpHours)}
                                                disabled={isBusy}
                                            >
                                                +{followUpHours}h
                                            </button>
                                            <button
                                                className="btn-followup done"
                                                onClick={() => markCustomerReplied(order)}
                                                disabled={isBusy}
                                            >
                                                Replied
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {drafts.length > 0 && (
                <div className="order-section">
                    <h4 className="section-label draft-label">Draft Orders ({drafts.length})</h4>
                    <div className="draft-swipe-hint">Swipe left on a draft card to delete.</div>
                    {drafts.map((order) => (
                        <SwipeableDraftCard
                            key={order.id}
                            onOpen={() => handleOrderClick(order)}
                            onDelete={() => requestDeleteOrder(order.id)}
                        >
                            <div className="order-card glass-panel draft clickable">
                                <div className="order-card-header">
                                    <div>
                                        <span className="order-name">{order.address.name || 'No Name'}</span>
                                        <span className="order-date">{formatDate(order.createdAt)}</span>
                                    </div>
                                    <span className="status-badge draft">Draft</span>
                                </div>

                                <div className="order-card-body">
                                    <div className="order-detail">
                                        <span>📱 {order.address.phone || '—'}</span>
                                        <span>📍 {order.address.pincode || '—'}</span>
                                    </div>
                                    <div className="order-detail">
                                        <span>{order.items.length} item(s)</span>
                                        <span className="order-total">₹{order.grandTotal}</span>
                                    </div>
                                    <div className="order-detail">
                                        <span>Stage: {order.stage}</span>
                                        <span className={`payment-chip ${order.paymentStatus}`}>{order.paymentStatus}</span>
                                    </div>
                                    <div className="order-detail">
                                        <span>Source</span>
                                        <span className="source-chip">{getSourceLabel(order.orderSource)}</span>
                                    </div>
                                </div>

                                {confirmingId === order.id ? (
                                    <div className="confirm-section" onClick={e => e.stopPropagation()}>
                                        <h5>Enter Tracking Details</h5>
                                        <input
                                            type="text"
                                            placeholder="Tracking ID"
                                            value={trackForm.trackingId}
                                            onChange={(e) => setTrackForm({ ...trackForm, trackingId: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Courier Name"
                                            value={trackForm.trackingCourier}
                                            onChange={(e) => setTrackForm({ ...trackForm, trackingCourier: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Tracking Link"
                                            value={trackForm.trackingLink}
                                            onChange={(e) => setTrackForm({ ...trackForm, trackingLink: e.target.value })}
                                        />
                                        <div className="confirm-actions">
                                            <button className="btn-cancel" onClick={() => setConfirmingId(null)}>Cancel</button>
                                            <button className="btn-confirm" onClick={() => handleConfirm(order)}>✅ Confirm</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="order-card-actions">
                                        <button className="btn-ship" onClick={(e) => handleShipClick(e, order)} disabled={shippingLoading}>
                                            {shippingLoading && shippingOrder?.id === order.id ? 'Loading...' : '🚀 Ship'}
                                        </button>
                                        <button
                                            className="btn-confirm-manual"
                                            onClick={(e) => togglePaymentStatus(e, order)}
                                        >
                                            {order.paymentStatus === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                                        </button>
                                        <button className="btn-confirm-manual" onClick={(e) => { e.stopPropagation(); setConfirmingId(order.id); }}>
                                            Manual Confirm
                                        </button>
                                        <button className="btn-delete" onClick={(e) => handleDelete(e, order.id)}>🗑</button>
                                    </div>
                                )}
                            </div>
                        </SwipeableDraftCard>
                    ))}
                </div>
            )}

            {confirmed.length > 0 && (
                <div className="order-section">
                    <h4 className="section-label confirmed-label">
                        Confirmed Orders ({filteredConfirmed.length}/{confirmed.length})
                    </h4>

                    <div className="confirmed-filters glass-panel">
                        <div className="filter-field">
                            <label>Pincode</label>
                            <input
                                type="text"
                                placeholder="Filter by pincode"
                                value={confirmedPincodeFilter}
                                maxLength={6}
                                onChange={(e) => setConfirmedPincodeFilter(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>
                        <div className="filter-field">
                            <label>Order Source</label>
                            <select
                                value={confirmedSourceFilter}
                                onChange={(e) => setConfirmedSourceFilter(e.target.value as 'all' | OrderSource)}
                            >
                                <option value="all">All Sources</option>
                                {ORDER_SOURCES.map((source) => (
                                    <option key={source} value={source}>
                                        {getSourceLabel(source)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            className="btn-clear-filters"
                            onClick={() => {
                                setConfirmedPincodeFilter('');
                                setConfirmedSourceFilter('all');
                            }}
                        >
                            Clear
                        </button>
                    </div>

                    <div className="confirmed-totals-row">
                        <div className="totals-chip glass-panel">
                            <span>Orders</span>
                            <strong>{confirmedTotals.count}</strong>
                        </div>
                        <div className="totals-chip glass-panel">
                            <span>Books Total</span>
                            <strong>₹{Math.round(confirmedTotals.booksTotal)}</strong>
                        </div>
                        <div className="totals-chip glass-panel">
                            <span>Shipping Total</span>
                            <strong>₹{Math.round(confirmedTotals.shippingTotal)}</strong>
                        </div>
                        <div className="totals-chip glass-panel">
                            <span>Grand Total</span>
                            <strong>₹{Math.round(confirmedTotals.grandTotal)}</strong>
                        </div>
                    </div>

                    {filteredConfirmed.length === 0 && (
                        <div className="orders-empty filtered-empty">
                            No confirmed orders match this filter.
                        </div>
                    )}

                    {filteredConfirmed.map((order) => (
                        <div key={order.id} className="order-card glass-panel confirmed clickable" onClick={() => handleOrderClick(order)}>
                            <div className="order-card-header">
                                <div>
                                    <span className="order-name">{order.address.name || 'No Name'}</span>
                                    <span className="order-date">{formatDate(order.createdAt)}</span>
                                </div>
                                <span className="status-badge confirmed">Confirmed</span>
                            </div>

                            <div className="order-card-body">
                                <div className="order-detail">
                                    <span>📱 {order.address.phone || '—'}</span>
                                    <span>📍 {order.address.pincode || '—'}</span>
                                </div>
                                <div className="order-detail">
                                    <span>{order.items.length} item(s)</span>
                                    <span className="order-total">₹{order.grandTotal}</span>
                                </div>
                                <div className="order-detail">
                                    <span>Stage: {order.stage}</span>
                                    <span className={`payment-chip ${order.paymentStatus}`}>{order.paymentStatus}</span>
                                </div>
                                <div className="order-detail">
                                    <span>Source</span>
                                    <span className="source-chip">{getSourceLabel(order.orderSource)}</span>
                                </div>
                                {order.trackingId && (
                                    <div className="tracking-info">
                                        <span>🚚 {order.trackingCourier}: <strong>{order.trackingId}</strong></span>
                                    </div>
                                )}
                            </div>

                            <div className="order-card-actions share-row">
                                <button className="share-btn whatsapp" onClick={(e) => shareWhatsApp(e, generateTrackingMessage(order), order.address.phone)}>
                                    WhatsApp
                                </button>
                                <button className="share-btn telegram" onClick={(e) => shareTelegram(e, generateTrackingMessage(order))}>
                                    Telegram
                                </button>
                                <button
                                    className="btn-label"
                                    onClick={(e) => handleDownloadLabel(e, order)}
                                    disabled={actionLoading === order.id}
                                >
                                    {actionLoading === order.id ? '...' : (order.labelUrl ? 'Label ⬇️' : 'Get Label')}
                                </button>
                                <button
                                    className="btn-cancel-ship"
                                    onClick={(e) => handleCancelShipment(e, order.id)}
                                    disabled={actionLoading === order.id}
                                >
                                    {actionLoading === order.id ? '...' : 'Cancel ❌'}
                                </button>
                                <button className="btn-delete" onClick={(e) => handleDelete(e, order.id)}>🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {sourcePrompt && (
                <div className="source-modal-overlay" onClick={handleSourcePromptCancel}>
                    <div className="source-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                        <h4>Select Order Source</h4>
                        <p>
                            Mark source before {sourcePrompt.action === 'ship' ? 'shipping confirmation' : 'order confirmation'}.
                        </p>
                        <label className="source-select-field">
                            <span>Source</span>
                            <select
                                value={sourceSelection}
                                onChange={(e) => setSourceSelection(e.target.value as OrderSource)}
                            >
                                {ORDER_SOURCES.map((source) => (
                                    <option key={source} value={source}>
                                        {getSourceLabel(source)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="source-modal-actions">
                            <button type="button" className="btn-cancel" onClick={handleSourcePromptCancel} disabled={savingSource}>
                                Cancel
                            </button>
                            <button type="button" className="btn-confirm" onClick={handleSourcePromptSave} disabled={savingSource}>
                                {savingSource ? 'Saving...' : 'Save & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <OrderDetailModal
                isOpen={isDetailOpen}
                onClose={() => {
                    setIsDetailOpen(false);
                    void loadOrders();
                }}
                order={selectedOrder}
            />


            {shippingQuotes && (
                <CourierModal
                    isOpen={showShipModal}
                    onClose={() => setShowShipModal(false)}
                    quotes={shippingQuotes}
                    selectedCourier={selectedCourier}
                    onSelect={setSelectedCourier}
                    onConfirm={handleCreateShipment}
                    confirmLabel={shippingLoading ? "Creating..." : "Confirm & Ship"}
                />
            )}
        </div>
    );
};

export default OrdersPage;
