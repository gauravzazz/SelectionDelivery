import React, { useState, useEffect } from 'react';
import { Order, OrderService } from '../api/orderApi';
import { MessageTemplate, MessageService } from '../api/messageApi';
import './OrderDetailModal.css';

interface OrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ isOpen, onClose, order }) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [messageText, setMessageText] = useState('');
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
    }, [order]);

    const loadTemplates = async () => {
        const data = await MessageService.getAll();
        setTemplates(data);
    };

    const handleTemplateSelect = (t: MessageTemplate) => {
        setSelectedTemplate(t);
        // Replace variables if needed
        let text = t.text;
        if (order) {
            text = text.replace('{orderId}', order.id)
                .replace('{name}', order.address.name)
                .replace('{grandTotal}', String(order.grandTotal))
                .replace('{trackingCourier}', order.trackingCourier || order.courierName || '')
                .replace('{trackingId}', order.trackingId || '')
                .replace('{trackingLink}', order.trackingLink || '');
        }
        setMessageText(text);
    };

    const handleSendMessage = () => {
        if (!messageText) return;
        const phone = order?.address.phone;
        if (phone) {
            window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(messageText)}`, '_blank');
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
        }
    };

    const handleSendTelegram = () => {
        if (!messageText) return;
        window.open(`https://t.me/share/url?url=.&text=${encodeURIComponent(messageText)}`, '_blank');
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

                            <div className="template-chips">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        className={`chip ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                                        onClick={() => handleTemplateSelect(t)}
                                    >
                                        {t.title}
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
