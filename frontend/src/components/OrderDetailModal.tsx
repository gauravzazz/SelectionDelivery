import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderService, OrderSource, OrderStage } from '../api/orderApi';
import { MessageTemplate, MessageService } from '../api/messageApi';
import { getStageLabel, pickSuggestedTemplate, sortTemplatesByStage } from '../engine/templateSuggestions';
import { addHoursIso, getOrderFollowUpHours, readFollowUpHours } from '../engine/followupScheduler';
import './OrderDetailModal.css';

function getSourceLabel(source?: OrderSource): string {
    if (source === 'pdf2printout') return 'pdf2printout';
    if (source === 'onlineprintout.com') return 'onlineprintout.com';
    return 'Not set';
}

interface OrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ isOpen, onClose, order }) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [messageText, setMessageText] = useState('');
    const [templatePinnedByUser, setTemplatePinnedByUser] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftDetails, setDraftDetails] = useState({
        name: '',
        phone: '',
        pincode: '',
        city: '',
        state: '',
        fullAddress: '',
        courierName: '',
        shippingCharge: 0,
    });

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!order) return;
        setDraftDetails({
            name: order.address.name || '',
            phone: order.address.phone || '',
            pincode: order.address.pincode || '',
            city: order.address.city || '',
            state: order.address.state || '',
            fullAddress: order.address.fullAddress || '',
            courierName: order.courierName || '',
            shippingCharge: order.shippingCharge || 0,
        });
        setTemplatePinnedByUser(false);
        setSelectedTemplate(null);
        setMessageText('');
    }, [order]);

    const messagingStage = useMemo<OrderStage>(() => {
        if (!order) return 'quote_shared';
        if (order.status === 'confirmed' && order.trackingId) return 'shipped';
        if (order.stage) return order.stage;
        return order.paymentStatus === 'paid' ? 'paid' : 'awaiting_payment';
    }, [order]);

    const orderedTemplates = useMemo(
        () => sortTemplatesByStage(templates, messagingStage),
        [templates, messagingStage],
    );
    const suggestedTemplate = useMemo(
        () => pickSuggestedTemplate(templates, messagingStage),
        [templates, messagingStage],
    );

    const loadTemplates = async () => {
        const data = await MessageService.getAll();
        setTemplates(data);
    };

    const handleTemplateSelect = (t: MessageTemplate, pinSelection: boolean = true) => {
        if (pinSelection) setTemplatePinnedByUser(true);
        setSelectedTemplate(t);
        let text = t.text;
        if (order) {
            const tokenMap: Record<string, string> = {
                orderId: order.id,
                name: order.address.name || '',
                grandTotal: String(order.grandTotal || 0),
                courier: order.courierName || '',
                shipping: String(order.shippingCharge || 0),
                trackingCourier: order.trackingCourier || order.courierName || '',
                trackingId: order.trackingId || '',
                trackingLink: order.trackingLink || '',
            };

            Object.entries(tokenMap).forEach(([key, value]) => {
                text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            });
        }
        setMessageText(text);
    };

    const scheduleFollowUpAfterOutboundMessage = async () => {
        if (!order || order.status !== 'draft') return;
        try {
            const hours = getOrderFollowUpHours(order, readFollowUpHours());
            const nowIso = new Date().toISOString();
            await OrderService.updateOrder(order.id, {
                followUpAfterHours: hours,
                lastOutboundMessageAt: nowIso,
                nextFollowUpAt: addHoursIso(nowIso, hours),
                followUpStatus: 'scheduled',
                followUpCount: (order.followUpCount || 0) + 1,
            });
        } catch (error) {
            console.error('Failed to schedule follow-up after outbound message', error);
        }
    };

    useEffect(() => {
        if (!isOpen || !order) return;
        if (templatePinnedByUser) return;
        if (!suggestedTemplate) return;
        if (selectedTemplate?.id === suggestedTemplate.id && messageText.trim()) return;
        handleTemplateSelect(suggestedTemplate, false);
    }, [
        isOpen,
        order,
        suggestedTemplate,
        templatePinnedByUser,
        selectedTemplate?.id,
        messageText,
    ]);

    const handleSendMessage = () => {
        if (!messageText) return;
        const phone = order?.address.phone;
        if (phone) {
            window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(messageText)}`, '_blank');
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
        }
        void scheduleFollowUpAfterOutboundMessage();
    };

    const handleSendTelegram = () => {
        if (!messageText) return;
        window.open(`https://t.me/share/url?url=.&text=${encodeURIComponent(messageText)}`, '_blank');
        void scheduleFollowUpAfterOutboundMessage();
    };

    const getMissingDraftFields = () => {
        const missing: string[] = [];
        if (!draftDetails.name.trim()) missing.push('Customer name');
        if (!/^\d{10}$/.test(draftDetails.phone.trim())) missing.push('Mobile number (10 digits)');
        if (!/^\d{6}$/.test(draftDetails.pincode.trim())) missing.push('Pincode (6 digits)');
        if (!draftDetails.fullAddress.trim()) missing.push('Full delivery address');
        if (!draftDetails.courierName.trim() || draftDetails.courierName.trim().toUpperCase() === 'TBD') {
            missing.push('Delivery partner');
        }
        return missing;
    };

    const handleSaveDraftDetails = async () => {
        if (!order) return;
        const missing = getMissingDraftFields();
        if (missing.length > 0) {
            alert(`Please fill required fields:\n- ${missing.join('\n- ')}`);
            return;
        }
        setSavingDraft(true);
        try {
            await OrderService.updateOrder(order.id, {
                address: {
                    name: draftDetails.name.trim(),
                    phone: draftDetails.phone.trim(),
                    pincode: draftDetails.pincode.trim(),
                    city: draftDetails.city.trim(),
                    state: draftDetails.state.trim(),
                    fullAddress: draftDetails.fullAddress.trim(),
                },
                courierName: draftDetails.courierName.trim(),
                shippingCharge: Number(draftDetails.shippingCharge) || 0,
                stage: 'address_captured',
            });
            alert('Draft details updated.');
        } catch (error) {
            console.error('Failed to update draft details', error);
            alert('Failed to update draft details');
        } finally {
            setSavingDraft(false);
        }
    };

    if (!isOpen || !order) return null;
    const missingDraftFields = order.status === 'draft' ? getMissingDraftFields() : [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Order #{order.id.slice(-6).toUpperCase()}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body-split">
                    {/* LEFT: Order Details (unchanged) */}
                    <div className="order-details-pane">
                        <div className="detail-section">
                            <h4>📍 Customer</h4>
                            <p><strong>{draftDetails.name || '—'}</strong></p>
                            <p>{draftDetails.fullAddress || '—'}</p>
                            <p>Phone: {draftDetails.phone || '—'}</p>
                            <p>PIN: {draftDetails.pincode || '—'}</p>
                        </div>

                        <div className="detail-section">
                            <h4>📦 Items ({order.items.length})</h4>
                            <div className="item-list-compact">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="item-row">
                                        <span>{item.title} ({item.variant})</span>
                                        <span>x{item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="detail-section">
                            <h4>💰 Payment</h4>
                            <div className="payment-row">
                                <span>Total</span>
                                <strong>₹{order.grandTotal}</strong>
                            </div>
                            <div className="payment-row">
                                <span>Shipping</span>
                                <span>₹{draftDetails.shippingCharge} ({draftDetails.courierName || 'TBD'})</span>
                            </div>
                            <div className="payment-row">
                                <span>Stage</span>
                                <span>{order.stage}</span>
                            </div>
                            <div className="payment-row">
                                <span>Order</span>
                                <span className={`status-badge ${order.status}`}>{order.status}</span>
                            </div>
                            <div className="payment-row">
                                <span>Payment</span>
                                <span className={`status-badge ${order.paymentStatus}`}>{order.paymentStatus}</span>
                            </div>
                            <div className="payment-row">
                                <span>Source</span>
                                <span>{getSourceLabel(order.orderSource)}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Actions & Messaging */}
                    <div className="order-actions-pane">
                        {order.status === 'draft' && (
                            <div className="action-section draft-details-section">
                                <div className="section-header-row">
                                    <h4>📌 Draft Required Details</h4>
                                </div>
                                {missingDraftFields.length > 0 ? (
                                    <div className="missing-fields-box">
                                        Missing: {missingDraftFields.join(', ')}
                                    </div>
                                ) : (
                                    <div className="missing-fields-box ok">All required draft details captured.</div>
                                )}
                                <div className="draft-form-grid">
                                    <input
                                        type="text"
                                        placeholder="Customer Name"
                                        value={draftDetails.name}
                                        onChange={(e) => setDraftDetails((prev) => ({ ...prev, name: e.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Mobile (10 digits)"
                                        maxLength={10}
                                        value={draftDetails.phone}
                                        onChange={(e) =>
                                            setDraftDetails((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))
                                        }
                                    />
                                    <input
                                        type="text"
                                        placeholder="Pincode"
                                        maxLength={6}
                                        value={draftDetails.pincode}
                                        onChange={(e) =>
                                            setDraftDetails((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, '') }))
                                        }
                                    />
                                    <input
                                        type="text"
                                        placeholder="City"
                                        value={draftDetails.city}
                                        onChange={(e) => setDraftDetails((prev) => ({ ...prev, city: e.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="State"
                                        value={draftDetails.state}
                                        onChange={(e) => setDraftDetails((prev) => ({ ...prev, state: e.target.value }))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Delivery Partner (e.g. Delhivery)"
                                        value={draftDetails.courierName}
                                        onChange={(e) => setDraftDetails((prev) => ({ ...prev, courierName: e.target.value }))}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Shipping Charge"
                                        value={draftDetails.shippingCharge}
                                        onChange={(e) =>
                                            setDraftDetails((prev) => ({
                                                ...prev,
                                                shippingCharge: Math.max(0, Number(e.target.value) || 0),
                                            }))
                                        }
                                    />
                                </div>
                                <textarea
                                    className="draft-address-textarea"
                                    placeholder="Full delivery address"
                                    value={draftDetails.fullAddress}
                                    onChange={(e) => setDraftDetails((prev) => ({ ...prev, fullAddress: e.target.value }))}
                                    rows={3}
                                />
                                <button className="btn-save-draft-details" onClick={handleSaveDraftDetails} disabled={savingDraft}>
                                    {savingDraft ? 'Saving...' : 'Save Draft Details'}
                                </button>
                            </div>
                        )}

                        <div className="action-section">
                            <div className="section-header-row">
                                <h4>💬 Send Message</h4>
                            </div>
                            <div className="template-suggestion-line">
                                <span>
                                    Suggested for {getStageLabel(messagingStage)}: {suggestedTemplate?.title || 'No specific suggestion'}
                                </span>
                                {templatePinnedByUser && suggestedTemplate && selectedTemplate?.id !== suggestedTemplate.id && (
                                    <button
                                        type="button"
                                        className="btn-link-action"
                                        onClick={() => {
                                            setTemplatePinnedByUser(false);
                                            handleTemplateSelect(suggestedTemplate, false);
                                        }}
                                    >
                                        Use Suggested
                                    </button>
                                )}
                            </div>

                            <div className="template-chips">
                                {orderedTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        className={`chip ${selectedTemplate?.id === t.id ? 'active' : ''} ${suggestedTemplate?.id === t.id ? 'recommended' : ''}`}
                                        onClick={() => handleTemplateSelect(t)}
                                    >
                                        {suggestedTemplate?.id === t.id ? `⭐ ${t.title}` : t.title}
                                    </button>
                                ))}
                            </div>

                            <div className="message-editor">
                                <textarea
                                    className="message-input"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    placeholder="Select a template or type a message..."
                                    rows={5}
                                />
                                <div className="message-toolbar">
                                    <button className="btn-whatsapp" onClick={handleSendMessage} disabled={!messageText}>
                                        Share on WhatsApp ✈️
                                    </button>
                                    <button className="btn-whatsapp telegram-btn" onClick={handleSendTelegram} disabled={!messageText}>
                                        Share on Telegram
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
