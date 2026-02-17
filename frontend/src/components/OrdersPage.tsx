import React, { useState, useEffect } from 'react';
import { Order, OrderService } from '../api/orderApi';
import { fetchShippingQuote, QuoteResponse, createShipment } from '../api/shippingApi';
import CourierModal from './CourierModal';
import OrderDetailModal from './OrderDetailModal';
import MessageManager from './MessageManager';
import './OrdersPage.css';

const OrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isMsgManagerOpen, setIsMsgManagerOpen] = useState(false);

    // Shipping confirmation state
    const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
    const [shippingQuotes, setShippingQuotes] = useState<QuoteResponse | null>(null);
    const [showShipModal, setShowShipModal] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<QuoteResponse['allOptions'][0] | null>(null);
    const [shippingLoading, setShippingLoading] = useState(false);

    // Manual Confirm State
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [trackForm, setTrackForm] = useState({ trackingId: '', trackingCourier: '', trackingLink: '' });

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await OrderService.getAllOrders();
            setOrders(data);
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    const handleOrderClick = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const handleShipClick = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation(); // Prevent opening detail modal
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
                setSelectedCourier(quotes.cheapest);
            }
            setShowShipModal(true);
        } catch (err) {
            alert('Failed to fetch shipping rates. Please check pincode.');
            console.error(err);
        } finally {
            setShippingLoading(false);
        }
    };

    const handleCreateShipment = async () => {
        if (!shippingOrder || !selectedCourier) return;

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

    const handleConfirm = async (orderId: string) => {
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

    const handleDelete = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this order?')) return;
        try {
            await OrderService.deleteOrder(orderId);
            loadOrders();
            if (selectedOrder?.id === orderId) setIsDetailOpen(false);
        } catch (err) {
            console.error('Delete failed:', err);
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

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="orders-page">
                <h3>📋 Orders</h3>
                <div className="orders-loading">Loading orders...</div>
            </div>
        );
    }

    const drafts = orders.filter(o => o.status === 'draft');
    const confirmed = orders.filter(o => o.status === 'confirmed');

    return (
        <div className="orders-page">
            <div className="orders-header">
                <h3>📋 Orders</h3>
                <button className="btn-manage-msgs" onClick={() => setIsMsgManagerOpen(true)}>
                    💬 Manage Templates
                </button>
            </div>

            {orders.length === 0 && (
                <div className="orders-empty">
                    <div className="empty-icon">📭</div>
                    <p>No orders yet. Create one from the Cart.</p>
                </div>
            )}

            {drafts.length > 0 && (
                <div className="order-section">
                    <h4 className="section-label draft-label">Draft Orders ({drafts.length})</h4>
                    {drafts.map((order) => (
                        <div key={order.id} className="order-card glass-panel draft clickable" onClick={() => handleOrderClick(order)}>
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
                                        <button className="btn-confirm" onClick={() => handleConfirm(order.id)}>✅ Confirm</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="order-card-actions">
                                    <button className="btn-ship" onClick={(e) => handleShipClick(e, order)} disabled={shippingLoading}>
                                        {shippingLoading && shippingOrder?.id === order.id ? 'Loading...' : '🚀 Ship'}
                                    </button>
                                    <button className="btn-confirm-manual" onClick={(e) => { e.stopPropagation(); setConfirmingId(order.id); }}>
                                        Manual Confirm
                                    </button>
                                    <button className="btn-delete" onClick={(e) => handleDelete(e, order.id)}>🗑</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {confirmed.length > 0 && (
                <div className="order-section">
                    <h4 className="section-label confirmed-label">Confirmed Orders ({confirmed.length})</h4>
                    {confirmed.map((order) => (
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
                                <button className="btn-delete" onClick={(e) => handleDelete(e, order.id)}>🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            <OrderDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                order={selectedOrder}
                onManageTemplates={() => setIsMsgManagerOpen(true)}
            />

            <MessageManager
                isOpen={isMsgManagerOpen}
                onClose={() => setIsMsgManagerOpen(false)}
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
