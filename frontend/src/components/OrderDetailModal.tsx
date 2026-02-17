import React, { useState, useEffect } from 'react';
import { Order } from '../api/orderApi';
import { MessageTemplate, MessageService } from '../api/messageApi';
import './OrderDetailModal.css';

interface OrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onManageTemplates: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ isOpen, onClose, order, onManageTemplates }) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [messageText, setMessageText] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        const data = await MessageService.getAll();
        if (data.length === 0) {
            await MessageService.initializeDefaults();
            const defaults = await MessageService.getAll();
            setTemplates(defaults);
        } else {
            setTemplates(data);
        }
    };

    const handleTemplateSelect = (t: MessageTemplate) => {
        setSelectedTemplate(t);
        // Replace variables if needed
        let text = t.text;
        if (order) {
            text = text.replace('{orderId}', order.id)
                .replace('{name}', order.address.name)
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

    if (!isOpen || !order) return null;

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
                            <p><strong>{order.address.name}</strong></p>
                            <p>{order.address.fullAddress}</p>
                            <p>Phone: {order.address.phone}</p>
                            <p>PIN: {order.address.pincode}</p>
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
                                <span>Status</span>
                                <span className={`status-badge ${order.status}`}>{order.status}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Actions & Messaging */}
                    <div className="order-actions-pane">
                        <div className="action-section">
                            <div className="section-header-row">
                                <h4>💬 Send Message</h4>
                                <button className="btn-link-action" onClick={onManageTemplates}>⚙️ Edit Templates</button>
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
