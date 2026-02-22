import React, { useEffect, useMemo, useState } from 'react';
import { MessageService, MessageTemplate } from '../api/messageApi';
import { OrderService, OrderAddress, OrderItem, OrderStage, parseAddress } from '../api/orderApi';
import { fetchShippingQuote, QuoteResponse } from '../api/shippingApi';
import CourierModal from './CourierModal';
import { getStageLabel, pickSuggestedTemplate, sortTemplatesByStage } from '../engine/templateSuggestions';
import { addHoursIso, readFollowUpHours } from '../engine/followupScheduler';
import './OrderFlow.css';

interface OrderFlowProps {
    items: OrderItem[];
    booksTotal: number;
    shippingCharge: number;
    courierName: string;
    selectedCourierId?: string;
    adjustment: number;
    adjustmentType: 'discount' | 'markup';
    grandTotal: number;
    weightGrams: number;
    address: OrderAddress;
    setAddress: React.Dispatch<React.SetStateAction<OrderAddress>>;
    notes: string;
    setNotes: React.Dispatch<React.SetStateAction<string>>;
    rawText: string;
    setRawText: React.Dispatch<React.SetStateAction<string>>;
    onComplete: () => void;
    onCancel: () => void;
}

function replaceTemplateTokens(template: string, tokens: Record<string, string>): string {
    return Object.entries(tokens).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
        template,
    );
}

const OrderFlow: React.FC<OrderFlowProps> = ({
    items,
    booksTotal,
    shippingCharge,
    courierName,
    selectedCourierId,
    adjustment,
    adjustmentType,
    grandTotal,
    weightGrams,
    address,
    setAddress,
    notes,
    setNotes,
    rawText,
    setRawText,
    onComplete,
    onCancel,
}) => {
    const [step, setStep] = useState<'paste' | 'review' | 'done'>(() =>
        address.fullAddress ? 'review' : 'paste',
    );
    const [saving, setSaving] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [shippingLoading, setShippingLoading] = useState(false);
    const [shippingQuotes, setShippingQuotes] = useState<QuoteResponse | null>(null);
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<QuoteResponse['allOptions'][0] | null>(
        selectedCourierId && shippingCharge > 0
            ? {
                courierId: selectedCourierId,
                courierName,
                source: 'Manual',
                price: shippingCharge,
                deliveryDays: 0,
                available: true,
                storePincode: '',
                storeName: '',
            }
            : null,
    );
    const [quotedPincode, setQuotedPincode] = useState(address.pincode || '');
    const [quotedWeight, setQuotedWeight] = useState(weightGrams);
    const [quotedItemMixSignature, setQuotedItemMixSignature] = useState('');
    const [autoRequoteNote, setAutoRequoteNote] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'upi' | 'cash' | 'bank' | 'other'>('upi');
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [templatePinnedByUser, setTemplatePinnedByUser] = useState(false);
    const itemMixSignature = useMemo(
        () =>
            items
                .map((item) => `${item.bookId}:${item.variant}:${item.quantity}:${item.pageCount}`)
                .sort()
                .join('|'),
        [items],
    );

    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const data = await MessageService.getAll();
                setTemplates(data);
            } catch (error) {
                console.error('Failed to load templates', error);
            }
        };
        loadTemplates();
    }, []);

    const activeShipping = useMemo(() => {
        if (selectedCourier) {
            return {
                courierId: selectedCourier.courierId,
                courierName: selectedCourier.courierName,
                charge: selectedCourier.price,
            };
        }
        return {
            courierId: selectedCourierId,
            courierName,
            charge: shippingCharge,
        };
    }, [selectedCourier, selectedCourierId, courierName, shippingCharge]);

    useEffect(() => {
        if (!quotedItemMixSignature) {
            setQuotedItemMixSignature(itemMixSignature);
        }
    }, [quotedItemMixSignature, itemMixSignature]);

    const messagingStage = useMemo<OrderStage>(() => {
        if (isPaid) return 'paid';

        const hasAddressFields = Boolean(
            address.name.trim()
            && /^\d{10}$/.test(address.phone.trim())
            && /^\d{6}$/.test(address.pincode.trim())
            && address.fullAddress.trim(),
        );
        if (!hasAddressFields) return 'awaiting_address';

        const hasShipping = Boolean(activeShipping.courierName && activeShipping.courierName !== 'TBD');
        if (!hasShipping) return 'address_captured';

        return 'awaiting_payment';
    }, [isPaid, address, activeShipping.courierName]);

    const orderedTemplates = useMemo(
        () => sortTemplatesByStage(templates, messagingStage),
        [templates, messagingStage],
    );
    const suggestedTemplate = useMemo(
        () => pickSuggestedTemplate(templates, messagingStage),
        [templates, messagingStage],
    );

    useEffect(() => {
        if (templatePinnedByUser) return;
        if (!templates.length) {
            if (selectedTemplateId) setSelectedTemplateId('');
            return;
        }

        const validSelected = templates.some((template) => template.id === selectedTemplateId);
        if (suggestedTemplate) {
            if (selectedTemplateId !== suggestedTemplate.id) {
                setSelectedTemplateId(suggestedTemplate.id);
            }
            return;
        }

        if (!validSelected && selectedTemplateId) {
            setSelectedTemplateId('');
        }
    }, [templatePinnedByUser, templates, suggestedTemplate, selectedTemplateId]);

    const recomputedGrandTotal = useMemo(() => {
        if (adjustmentType === 'markup') {
            return Math.max(0, Math.round(booksTotal + activeShipping.charge + Math.abs(adjustment)));
        }
        return Math.max(0, Math.round(booksTotal + activeShipping.charge - Math.abs(adjustment)));
    }, [booksTotal, activeShipping.charge, adjustment, adjustmentType]);

    const generateSummaryMessage = () => {
        let msg = `*Draft Order Summary*\n\n`;
        items.forEach((item, idx) => {
            const mode = item.variant === 'color' ? 'Color' : 'B&W';
            msg += `${idx + 1}. ${item.title} [${mode}] x${item.quantity} = ₹${item.unitPrice * item.quantity}\n`;
        });
        msg += `\n*Books Total*: ₹${booksTotal}`;
        msg += `\n*Shipping*: ₹${activeShipping.charge} (${activeShipping.courierName || 'TBD'})`;
        if (adjustment > 0 && adjustmentType === 'discount') {
            msg += `\n*Discount*: -₹${adjustment}`;
        }
        if (adjustment > 0 && adjustmentType === 'markup') {
            msg += `\n*Markup*: +₹${adjustment}`;
        }
        msg += `\n*Grand Total*: ₹${recomputedGrandTotal}`;
        if (address.name) msg += `\n*Customer*: ${address.name}`;
        if (address.pincode) msg += `\n*Pincode*: ${address.pincode}`;
        msg += `\n*Payment*: ${isPaid ? 'Paid' : 'Pending'} (${paymentMode.toUpperCase()})`;
        return msg;
    };

    const getMessageToShare = () => {
        const summary = generateSummaryMessage();
        const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
        if (!selectedTemplate) return encodeURIComponent(summary);

        const templated = replaceTemplateTokens(selectedTemplate.text, {
            name: address.name || 'Customer',
            grandTotal: recomputedGrandTotal.toString(),
            courier: activeShipping.courierName || '',
            shipping: String(activeShipping.charge || 0),
            trackingCourier: activeShipping.courierName || '',
            trackingId: '',
            trackingLink: '',
            orderId: '',
        });

        return encodeURIComponent(`${templated}\n\n${summary}`);
    };

    const shareWhatsApp = () => {
        window.open(`https://wa.me/?text=${getMessageToShare()}`, '_blank');
    };

    const shareTelegram = () => {
        window.open(`https://t.me/share/url?url=.&text=${getMessageToShare()}`, '_blank');
    };

    const handleParse = async () => {
        if (!rawText.trim()) {
            setStep('review');
            return;
        }
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
                setAddress((prev) => ({ ...prev, ...data.parsed }));
                setStep('review');
                return;
            }
        } catch (err) {
            console.error('Parse error:', err);
        } finally {
            setParsing(false);
        }

        const parsed = parseAddress(rawText);
        setAddress((prev) => ({ ...prev, ...parsed }));
        setStep('review');
    };

    const recalculateShipping = async (opts?: { auto?: boolean; reason?: string }) => {
        if (!address.pincode || !/^\d{6}$/.test(address.pincode)) {
            if (!opts?.auto) {
                alert('Enter valid 6-digit pincode to fetch shipping.');
            }
            return;
        }
        setShippingLoading(true);
        try {
            const quote = await fetchShippingQuote({
                destinationPincode: address.pincode,
                weightGrams,
            });
            setShippingQuotes(quote);
            if (quote.allOptions.length > 0) {
                const preferred =
                    selectedCourier
                        ? quote.allOptions.find((opt) => opt.courierId === selectedCourier.courierId)
                        : null;
                setSelectedCourier(preferred || quote.cheapest);
                if (!opts?.auto) {
                    setShowCourierModal(true);
                }
                setQuotedPincode(address.pincode);
                setQuotedWeight(weightGrams);
                setQuotedItemMixSignature(itemMixSignature);
                if (opts?.auto && opts.reason) {
                    setAutoRequoteNote(`Shipping auto-requoted because ${opts.reason}.`);
                } else {
                    setAutoRequoteNote('');
                }
            }
        } catch (error) {
            console.error('Shipping quote failed', error);
            if (!opts?.auto) {
                alert('Failed to fetch shipping options for this pincode.');
            }
        } finally {
            setShippingLoading(false);
        }
    };

    useEffect(() => {
        if (shippingLoading) return;
        const hasShippingContext = Boolean(selectedCourier || (activeShipping.courierName && activeShipping.courierName !== 'TBD'));
        if (!hasShippingContext) return;
        if (!/^\d{6}$/.test(address.pincode || '')) return;

        const pincodeChanged = Boolean(quotedPincode && quotedPincode !== address.pincode);
        const weightChanged = quotedWeight !== weightGrams;
        const itemMixChanged = Boolean(quotedItemMixSignature && quotedItemMixSignature !== itemMixSignature);
        if (!pincodeChanged && !weightChanged && !itemMixChanged) return;

        let reason = 'order details changed';
        if (pincodeChanged) reason = 'pincode changed';
        else if (weightChanged) reason = 'weight changed';
        else if (itemMixChanged) reason = 'item mix changed';

        const timer = window.setTimeout(() => {
            void recalculateShipping({ auto: true, reason });
        }, 500);

        return () => window.clearTimeout(timer);
    }, [
        shippingLoading,
        selectedCourier,
        activeShipping.courierName,
        address.pincode,
        quotedPincode,
        quotedWeight,
        weightGrams,
        quotedItemMixSignature,
        itemMixSignature,
    ]);

    const handleSaveDraft = async () => {
        if (!address.name || !address.phone || !address.fullAddress || !address.pincode) {
            alert('Please fill Name, Phone, Pincode and Full Address');
            return;
        }
        setSaving(true);
        try {
            const hasShipping = Boolean(activeShipping.courierName && activeShipping.courierName !== 'TBD');
            const stage = isPaid
                ? 'paid'
                : hasShipping
                    ? 'awaiting_payment'
                    : 'address_captured';
            const draftPayload: Parameters<typeof OrderService.createDraft>[0] = {
                items,
                address,
                booksTotal,
                shippingCharge: activeShipping.charge,
                courierName: activeShipping.courierName || 'TBD',
                selectedCourierId: activeShipping.courierId,
                adjustment,
                adjustmentType,
                grandTotal: recomputedGrandTotal,
                weightGrams,
                notes,
                stage,
                paymentStatus: isPaid ? 'paid' : 'pending',
                paymentMode,
            };
            const followUpAfterHours = readFollowUpHours();
            draftPayload.followUpAfterHours = followUpAfterHours;
            if (isPaid) {
                draftPayload.followUpStatus = 'done';
            } else {
                const nowIso = new Date().toISOString();
                draftPayload.lastOutboundMessageAt = nowIso;
                draftPayload.nextFollowUpAt = addHoursIso(nowIso, followUpAfterHours);
                draftPayload.followUpStatus = 'scheduled';
                draftPayload.followUpCount = 0;
            }
            if (isPaid) {
                draftPayload.paidAt = new Date().toISOString();
            }

            await OrderService.createDraft(draftPayload);
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
                    <h3>Draft Order Saved</h3>
                    <p>Order can be resumed from Orders anytime until confirmed.</p>
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
                    <h3>Create / Resume Draft</h3>
                </div>

                <div className="order-summary-mini glass-panel">
                    <div className="mini-row">
                        <span>{items.length} item(s)</span>
                        <span>₹{grandTotal}</span>
                    </div>
                </div>

                <div className="paste-section glass-panel">
                    <h4>Paste Customer Address</h4>
                    <p className="hint-text">
                        Paste full text from chat. Gemini will extract name, phone, city, state and pincode.
                    </p>
                    <textarea
                        className="address-textarea"
                        placeholder={`John Doe\n9876543210\nFlat 2B, MG Road\nKolkata, West Bengal 700001`}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        rows={6}
                        autoFocus
                    />
                    <div className="stacked-btns">
                        <button
                            className="btn-primary"
                            onClick={handleParse}
                            disabled={parsing}
                        >
                            {parsing ? 'Analyzing...' : 'Parse & Continue'}
                        </button>
                        <button className="btn-secondary-flow" onClick={() => setStep('review')}>
                            Skip Parse, Fill Manually
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const needsShippingRecalc = Boolean(address.pincode) && quotedPincode !== address.pincode;

    return (
        <div className="order-flow">
            <div className="flow-header">
                <button className="back-btn" onClick={() => setStep('paste')}>← Back</button>
                <h3>Review Draft Details</h3>
            </div>

            <div className="address-form glass-panel">
                <h4>Delivery Address</h4>
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
                        onChange={(e) => setAddress({ ...address, phone: e.target.value.replace(/\D/g, '') })}
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
                            onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '') })}
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
                <div className="shipping-recalc-row">
                    <button className="btn-secondary-flow" onClick={() => void recalculateShipping()} disabled={shippingLoading}>
                        {shippingLoading ? 'Checking Shipping...' : 'Recalculate Shipping for Address'}
                    </button>
                    {needsShippingRecalc && (
                        <span className="recalc-hint">Pincode changed. Recalculate shipping before confirming.</span>
                    )}
                    {autoRequoteNote && !needsShippingRecalc && (
                        <span className="recalc-info">{autoRequoteNote}</span>
                    )}
                </div>
            </div>

            <div className="order-review-summary glass-panel">
                <h4>Order Summary</h4>
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
                    <span>Shipping ({activeShipping.courierName || 'TBD'})</span>
                    <span>₹{activeShipping.charge}</span>
                </div>
                {adjustment > 0 && (
                    <div className={`review-item ${adjustmentType}`}>
                        <span>{adjustmentType === 'discount' ? 'Discount' : 'Markup'}</span>
                        <span>{adjustmentType === 'discount' ? '-' : '+'}₹{adjustment}</span>
                    </div>
                )}
                <div className="review-divider"></div>
                <div className="review-item grand">
                    <span>Grand Total</span><span>₹{recomputedGrandTotal}</span>
                </div>
            </div>

            <div className="payment-box glass-panel">
                <h4>Payment</h4>
                <div className="payment-row-controls">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={(e) => setIsPaid(e.target.checked)}
                        />
                        Mark as Paid
                    </label>
                    <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as 'upi' | 'cash' | 'bank' | 'other')}
                    >
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>

            <div className="notes-section glass-panel">
                <h4>Notes</h4>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={2}
                />
            </div>

            <div className="message-share-box glass-panel">
                <h4>Share Quote / Draft Message</h4>
                <div className="message-template-row">
                    <label>Template</label>
                    <div className="template-suggestion-row">
                        <span>
                            Suggested for {getStageLabel(messagingStage)}: {suggestedTemplate?.title || 'Auto summary'}
                        </span>
                        {templatePinnedByUser && suggestedTemplate && selectedTemplateId !== suggestedTemplate.id && (
                            <button
                                type="button"
                                className="use-suggested-btn"
                                onClick={() => {
                                    setTemplatePinnedByUser(false);
                                    setSelectedTemplateId(suggestedTemplate.id);
                                }}
                            >
                                Use Suggested
                            </button>
                        )}
                    </div>
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => {
                            setTemplatePinnedByUser(true);
                            setSelectedTemplateId(e.target.value);
                        }}
                    >
                        <option value="">Use auto summary</option>
                        {orderedTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {suggestedTemplate?.id === template.id ? `⭐ ${template.title}` : template.title}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="share-buttons-flow">
                    <button className="share-btn whatsapp" onClick={shareWhatsApp}>
                        Share WhatsApp
                    </button>
                    <button className="share-btn telegram" onClick={shareTelegram}>
                        Share Telegram
                    </button>
                </div>
            </div>

            <button
                className="btn-primary save-order-btn"
                onClick={handleSaveDraft}
                disabled={saving}
            >
                {saving ? 'Saving Draft...' : 'Save Draft Order'}
            </button>

            {shippingQuotes && (
                <CourierModal
                    isOpen={showCourierModal}
                    onClose={() => setShowCourierModal(false)}
                    quotes={shippingQuotes}
                    selectedCourier={selectedCourier}
                    onSelect={(option) => {
                        setSelectedCourier(option);
                        setShowCourierModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default OrderFlow;
