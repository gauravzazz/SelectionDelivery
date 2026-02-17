import React, { useState } from 'react';
import { OrderService, OrderAddress, OrderItem, parseAddress } from '../api/orderApi';
import './OrderFlow.css';

interface OrderFlowProps {
    items: OrderItem[];
    booksTotal: number;
    shippingCharge: number;
    courierName: string;
    adjustment: number;
    adjustmentType: 'discount' | 'markup';
    grandTotal: number;
    weightGrams: number;
    onComplete: () => void;
    onCancel: () => void;
}

const OrderFlow: React.FC<OrderFlowProps> = ({
    items, booksTotal, shippingCharge, courierName,
    adjustment, adjustmentType, grandTotal, weightGrams,
    onComplete, onCancel,
}) => {
    const [step, setStep] = useState<'paste' | 'review' | 'done'>('paste');
    const [rawText, setRawText] = useState('');
    const [address, setAddress] = useState<OrderAddress>({
        name: '', phone: '', pincode: '', city: '', state: '', fullAddress: '',
    });
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');

    const [parsing, setParsing] = useState(false);

    const handleParse = async () => {
        if (!rawText.trim()) return;
        setParsing(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
            const res = await fetch(`${API_BASE}/address/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: rawText }),
            });
            const data = await res.json();

            if (data.success && data.parsed) {
                setAddress(prev => ({ ...prev, ...data.parsed }));
                setStep('review');
            } else {
                // Fallback to regex if API fails
                console.warn('AI parse failed, falling back to regex');
                const parsed = parseAddress(rawText);
                setAddress(prev => ({ ...prev, ...parsed }));
                setStep('review');
            }
        } catch (err) {
            console.error('Parse error:', err);
            // Fallback to regex
            const parsed = parseAddress(rawText);
            setAddress(prev => ({ ...prev, ...parsed }));
            setStep('review');
        } finally {
            setParsing(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!address.name || !address.phone || !address.fullAddress) {
            alert('Please fill Name, Phone and Address');
            return;
        }
        setSaving(true);
        try {
            await OrderService.createDraft({
                items,
                address,
                booksTotal,
                shippingCharge,
                courierName,
                adjustment,
                adjustmentType,
                grandTotal,
                weightGrams,
                notes,
            });
            setStep('done');
        } catch (err) {
            console.error('Draft save error:', err);
            alert('Failed to save order draft');
        } finally {
            setSaving(false);
        }
    };

    if (step === 'done') {
        return (
            <div className="order-flow">
                <div className="order-success glass-panel">
                    <div className="success-icon">✅</div>
                    <h3>Draft Order Saved!</h3>
                    <p>Go to <strong>Orders</strong> tab to confirm and share tracking.</p>
                    <button className="btn-primary" onClick={onComplete}>Go to Orders</button>
                </div>
            </div>
        );
    }

    if (step === 'paste') {
        return (
            <div className="order-flow">
                <div className="flow-header">
                    <button className="back-btn" onClick={onCancel}>← Back</button>
                    <h3>📋 Create Order</h3>
                </div>

                <div className="order-summary-mini glass-panel">
                    <div className="mini-row">
                        <span>{items.length} item(s)</span>
                        <span>₹{grandTotal}</span>
                    </div>
                </div>

                <div className="paste-section glass-panel">
                    <h4>Paste Customer Address</h4>
                    <p className="hint-text">Paste the full address text — we'll extract name, phone, pincode automatically</p>
                    <textarea
                        className="address-textarea"
                        placeholder={`John Doe\n9876543210\n123, MG Road, Sector 5\nNew Delhi, Delhi\n110001`}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        rows={6}
                        autoFocus
                    />
                    <button
                        className="btn-primary"
                        onClick={handleParse}
                        disabled={!rawText.trim() || parsing}
                    >
                        {parsing ? '✨ Analyzing...' : 'Parse & Continue →'}
                    </button>
                </div>
            </div>
        );
    }

    // Step: review
    return (
        <div className="order-flow">
            <div className="flow-header">
                <button className="back-btn" onClick={() => setStep('paste')}>← Back</button>
                <h3>Review Order</h3>
            </div>

            {/* Address Fields */}
            <div className="address-form glass-panel">
                <h4>📍 Delivery Address</h4>
                <div className="addr-field">
                    <label>Name</label>
                    <input
                        type="text"
                        value={address.name}
                        onChange={(e) => setAddress({ ...address, name: e.target.value })}
                        placeholder="Customer Name"
                    />
                </div>
                <div className="addr-field">
                    <label>Phone</label>
                    <input
                        type="text"
                        value={address.phone}
                        onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                        placeholder="10-digit number"
                        maxLength={10}
                    />
                </div>
                <div className="addr-row">
                    <div className="addr-field">
                        <label>Pincode</label>
                        <input
                            type="text"
                            value={address.pincode}
                            onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                            placeholder="6-digit"
                            maxLength={6}
                        />
                    </div>
                    <div className="addr-field">
                        <label>City</label>
                        <input
                            type="text"
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            placeholder="City"
                        />
                    </div>
                </div>
                <div className="addr-field">
                    <label>State</label>
                    <input
                        type="text"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        placeholder="State"
                    />
                </div>
                <div className="addr-field">
                    <label>Full Address</label>
                    <textarea
                        value={address.fullAddress}
                        onChange={(e) => setAddress({ ...address, fullAddress: e.target.value })}
                        placeholder="Complete address"
                        rows={3}
                    />
                </div>
            </div>

            {/* Order Summary */}
            <div className="order-review-summary glass-panel">
                <h4>🧾 Order Summary</h4>
                {items.map((item, i) => (
                    <div key={i} className="review-item">
                        <span>{item.title} [{item.variant === 'color' ? 'Color' : 'B&W'}] x{item.quantity}</span>
                        <span>₹{item.unitPrice * item.quantity}</span>
                    </div>
                ))}
                <div className="review-divider"></div>
                <div className="review-item">
                    <span>Books Total</span><span>₹{booksTotal}</span>
                </div>
                <div className="review-item">
                    <span>Shipping ({courierName})</span><span>₹{shippingCharge}</span>
                </div>
                {adjustment > 0 && (
                    <div className={`review-item ${adjustmentType}`}>
                        <span>{adjustmentType === 'discount' ? 'Discount' : 'Markup'}</span>
                        <span>{adjustmentType === 'discount' ? '-' : '+'}₹{adjustment}</span>
                    </div>
                )}
                <div className="review-divider"></div>
                <div className="review-item grand">
                    <span>Grand Total</span><span>₹{grandTotal}</span>
                </div>
            </div>

            {/* Notes */}
            <div className="notes-section glass-panel">
                <h4>📝 Notes (Optional)</h4>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={2}
                />
            </div>

            <button
                className="btn-primary save-order-btn"
                onClick={handleSaveDraft}
                disabled={saving}
            >
                {saving ? '⏳ Saving...' : '💾 Save Draft Order'}
            </button>
        </div>
    );
};

export default OrderFlow;
