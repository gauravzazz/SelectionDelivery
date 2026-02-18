import React, { useEffect, useMemo, useState } from 'react';
import { useBookContext } from '../context/BookContext';
import { fetchShippingQuote, QuoteResponse } from '../api/shippingApi';
import { OrderItem } from '../api/orderApi';
import { MessageService, MessageTemplate } from '../api/messageApi';
import { SettingsService, DEFAULT_PRICING_SETTINGS, PrintPricingSettings } from '../api/settingsApi';
import { calculateCustomPricing } from '../engine/customPricing';
import CourierModal from './CourierModal';
import './CartPage.css';

interface CartPageProps {
    onCreateOrder: (data: {
        items: OrderItem[];
        booksTotal: number;
        shippingCharge: number;
        courierName: string;
        selectedCourierId?: string;
        adjustment: number;
        adjustmentType: 'discount' | 'markup';
        grandTotal: number;
        weightGrams: number;
    }) => void;
}

function replaceTemplateTokens(template: string, tokens: Record<string, string>): string {
    return Object.entries(tokens).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
        template,
    );
}

const CartPage: React.FC<CartPageProps> = ({ onCreateOrder }) => {
    const {
        customCart,
        getCartDetails,
        totals,
        updateQuantity,
        removeFromCart,
        addCustomToCart,
        updateCustomItem,
        updateCustomQuantity,
        removeCustomFromCart,
    } = useBookContext();
    const catalogCartItems = getCartDetails();

    const [pricingSettings, setPricingSettings] = useState<PrintPricingSettings>(DEFAULT_PRICING_SETTINGS);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    const [customForm, setCustomForm] = useState({
        title: 'Custom Print Job',
        pageCount: 80,
        printMode: 'bw' as 'color' | 'bw',
        pageSize: pricingSettings.defaultPageSize,
        paperType: pricingSettings.defaultPaperType,
        bindingType: pricingSettings.defaultBindingType,
        quantity: 1,
    });

    const customPreview = useMemo(
        () =>
            calculateCustomPricing(
                {
                    pageCount: customForm.pageCount,
                    printMode: customForm.printMode,
                    pageSize: customForm.pageSize,
                    paperType: customForm.paperType,
                    bindingType: customForm.bindingType,
                },
                pricingSettings,
            ),
        [customForm, pricingSettings],
    );

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const [settings, msgTemplates] = await Promise.all([
                    SettingsService.getPricingSettings(),
                    MessageService.getAll(),
                ]);
                setPricingSettings(settings);
                setCustomForm((prev) => ({
                    ...prev,
                    pageSize: prev.pageSize || settings.defaultPageSize,
                    paperType: prev.paperType || settings.defaultPaperType,
                    bindingType: prev.bindingType || settings.defaultBindingType,
                }));
                setTemplates(msgTemplates);
            } catch (error) {
                console.error('Failed to load cart settings/templates', error);
            }
        };

        bootstrap();
    }, []);

    const [pincode, setPincode] = useState('');
    const [shippingQuote, setShippingQuote] = useState<QuoteResponse | null>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [error, setError] = useState('');
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<QuoteResponse['allOptions'][0] | null>(null);

    const [adjustment, setAdjustment] = useState(0);
    const [adjustmentType, setAdjustmentType] = useState<'discount' | 'markup'>('discount');

    const handleAddCustom = () => {
        if (customForm.pageCount <= 0 || customForm.quantity <= 0) {
            setError('Custom print page count and quantity must be at least 1');
            return;
        }

        addCustomToCart({
            title: customForm.title.trim() || 'Custom Print Job',
            quantity: customForm.quantity,
            pageCount: customForm.pageCount,
            printMode: customForm.printMode,
            pageSize: customForm.pageSize,
            paperType: customForm.paperType,
            bindingType: customForm.bindingType,
            unitPrice: customPreview.unitPrice,
            unitWeightGrams: customPreview.unitWeightGrams,
        });
        setError('');
    };

    const handleCustomFieldUpdate = (
        itemId: string,
        current: {
            pageCount: number;
            printMode: 'color' | 'bw';
            pageSize: string;
            paperType: string;
            bindingType: string;
        },
        updates: Partial<{
            pageCount: number;
            printMode: 'color' | 'bw';
            pageSize: string;
            paperType: string;
            bindingType: string;
            title: string;
        }>,
    ) => {
        const merged = { ...current, ...updates };
        const recalculated = calculateCustomPricing(
            {
                pageCount: merged.pageCount,
                printMode: merged.printMode,
                pageSize: merged.pageSize,
                paperType: merged.paperType,
                bindingType: merged.bindingType,
            },
            pricingSettings,
        );

        updateCustomItem(itemId, {
            ...updates,
            unitPrice: recalculated.unitPrice,
            unitWeightGrams: recalculated.unitWeightGrams,
        });

        if (shippingQuote) {
            setShippingQuote(null);
            setSelectedCourier(null);
        }
    };

    const handleCalculateShipping = async () => {
        if (!pincode || pincode.length !== 6) {
            setError('Enter valid 6-digit pincode');
            return;
        }
        if (totals.weight <= 0) {
            setError('Cart weight is zero. Add at least one item.');
            return;
        }
        setLoadingQuote(true);
        setError('');
        setShippingQuote(null);
        setSelectedCourier(null);

        try {
            const quote = await fetchShippingQuote({
                destinationPincode: pincode,
                weightGrams: totals.weight,
            });
            setShippingQuote(quote);

            if (quote.allOptions.length > 0) {
                setSelectedCourier(quote.cheapest);
                setShowCourierModal(true);
            }
        } catch (_error) {
            setError('Failed to fetch shipping rates. Try again.');
        } finally {
            setLoadingQuote(false);
        }
    };

    const activeCourier = selectedCourier || shippingQuote?.cheapest;

    const computeGrandTotal = () => {
        let grand = totals.price;
        const shipPrice = activeCourier?.price || 0;

        if (adjustmentType === 'markup') {
            grand += shipPrice + Math.abs(adjustment);
        } else {
            grand += shipPrice - Math.abs(adjustment);
        }

        return Math.max(0, Math.round(grand));
    };

    const effectiveShippingDisplay = () => {
        const shipPrice = activeCourier?.price || 0;
        if (adjustmentType === 'markup' && adjustment > 0) {
            return shipPrice + Math.abs(adjustment);
        }
        return shipPrice;
    };

    const generateSummaryMessage = () => {
        let msg = `*Print Order Quote*\n\n`;
        catalogCartItems.forEach((item, idx) => {
            const variantLabel = item.variant === 'color' ? 'Color' : 'B&W';
            const price = item.variant === 'color' ? item.book.priceColor : item.book.priceBW;
            msg += `${idx + 1}. ${item.book.title} [${variantLabel}] x${item.quantity} = ₹${price * item.quantity}\n`;
        });

        customCart.forEach((item, idx) => {
            const line = catalogCartItems.length + idx + 1;
            msg += `${line}. ${item.title} [Custom ${item.printMode.toUpperCase()} | ${item.pageCount}p | ${item.bindingType}] x${item.quantity} = ₹${item.unitPrice * item.quantity}\n`;
        });

        msg += `\n*Books Total*: ₹${totals.price}`;
        msg += `\n*Weight*: ${(totals.weight / 1000).toFixed(2)} kg`;

        if (activeCourier) {
            msg += `\n*Shipping* (${activeCourier.courierName}): ₹${effectiveShippingDisplay()}`;
            if (adjustmentType === 'discount' && adjustment > 0) {
                msg += `\n*Discount*: -₹${Math.abs(adjustment)}`;
            }
            msg += `\n\n*Grand Total*: ₹${computeGrandTotal()}`;
        } else {
            msg += `\n*Shipping*: Pending`;
            msg += `\n\n*Total (without shipping)*: ₹${totals.price}`;
        }

        return msg;
    };

    const generateBillMessage = () => {
        const summary = generateSummaryMessage();
        const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
        if (!selectedTemplate) {
            return encodeURIComponent(summary);
        }

        const withTemplate = replaceTemplateTokens(selectedTemplate.text, {
            name: 'Customer',
            grandTotal: computeGrandTotal().toString(),
            courier: activeCourier?.courierName || 'TBD',
            shipping: activeCourier ? `${activeCourier.price}` : 'Pending',
        });

        return encodeURIComponent(`${withTemplate}\n\n${summary}`);
    };

    const shareWhatsApp = () => {
        window.open(`https://wa.me/?text=${generateBillMessage()}`, '_blank');
    };

    const shareTelegram = () => {
        window.open(`https://t.me/share/url?url=.&text=${generateBillMessage()}`, '_blank');
    };

    const isCartEmpty = catalogCartItems.length === 0 && customCart.length === 0;

    if (isCartEmpty) {
        return (
            <div className="cart-page-empty">
                <div className="empty-icon">🛒</div>
                <h2>Your cart is empty</h2>
                <p>Add predefined books or custom print jobs to continue.</p>
            </div>
        );
    }

    return (
        <div className="cart-page-container">
            <h2 className="cart-page-title">Your Order</h2>

            <div className="custom-job-builder glass-panel">
                <div className="section-heading">
                    <h4>Custom Print Job</h4>
                    <span>For notes/books not in catalog</span>
                </div>
                <div className="custom-form-grid">
                    <input
                        type="text"
                        value={customForm.title}
                        onChange={(e) => setCustomForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Title (e.g. Semester Notes)"
                    />
                    <input
                        type="number"
                        min={1}
                        value={customForm.pageCount}
                        onChange={(e) =>
                            setCustomForm((prev) => ({
                                ...prev,
                                pageCount: Math.max(1, Number(e.target.value) || 1),
                            }))
                        }
                        placeholder="Pages"
                    />
                    <select
                        value={customForm.printMode}
                        onChange={(e) =>
                            setCustomForm((prev) => ({
                                ...prev,
                                printMode: e.target.value as 'color' | 'bw',
                            }))
                        }
                    >
                        <option value="bw">B&W</option>
                        <option value="color">Color</option>
                    </select>
                    <select
                        value={customForm.pageSize}
                        onChange={(e) => setCustomForm((prev) => ({ ...prev, pageSize: e.target.value }))}
                    >
                        {Object.keys(pricingSettings.sizeMultipliers).map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                    <select
                        value={customForm.paperType}
                        onChange={(e) => setCustomForm((prev) => ({ ...prev, paperType: e.target.value }))}
                    >
                        {Object.keys(pricingSettings.paperMultipliers).map((paperType) => (
                            <option key={paperType} value={paperType}>
                                {paperType}
                            </option>
                        ))}
                    </select>
                    <select
                        value={customForm.bindingType}
                        onChange={(e) => setCustomForm((prev) => ({ ...prev, bindingType: e.target.value }))}
                    >
                        {Object.keys(pricingSettings.bindingCharges).map((binding) => (
                            <option key={binding} value={binding}>
                                {binding}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min={1}
                        value={customForm.quantity}
                        onChange={(e) =>
                            setCustomForm((prev) => ({
                                ...prev,
                                quantity: Math.max(1, Number(e.target.value) || 1),
                            }))
                        }
                        placeholder="Qty"
                    />
                </div>
                <div className="custom-preview-row">
                    <span>Per copy: ₹{customPreview.unitPrice}</span>
                    <span>Weight: {(customPreview.unitWeightGrams / 1000).toFixed(2)} kg</span>
                    <button className="add-custom-btn" onClick={handleAddCustom}>
                        + Add Custom Job
                    </button>
                </div>
            </div>

            <div className="cart-list">
                {catalogCartItems.map(({ book, variant, quantity }) => {
                    const unitPrice = variant === 'color' ? book.priceColor : book.priceBW;
                    return (
                        <div key={`${book.id}-${variant}`} className="cart-item-card glass-panel">
                            <div className="cart-item-info">
                                <h3>{book.title}</h3>
                                <div className="cart-badges">
                                    <span className={`badge ${variant}`}>{variant === 'color' ? 'Color' : 'B&W'}</span>
                                    <span className="badge pages">{book.pageCount} Pages</span>
                                    <span className="badge pages">Catalog</span>
                                </div>
                                <div className="cart-price">₹{unitPrice} x {quantity}</div>
                            </div>
                            <div className="cart-actions">
                                <div className="qty-controls">
                                    <button onClick={() => updateQuantity(book.id, variant, -1)}>-</button>
                                    <span>{quantity}</span>
                                    <button onClick={() => updateQuantity(book.id, variant, 1)}>+</button>
                                </div>
                                <button className="delete-btn" onClick={() => removeFromCart(book.id, variant)}>
                                    🗑
                                </button>
                            </div>
                        </div>
                    );
                })}

                {customCart.map((item) => (
                    <div key={item.id} className="cart-item-card glass-panel custom-item-card">
                        <div className="cart-item-info">
                            <input
                                className="custom-item-title-input"
                                value={item.title}
                                onChange={(e) =>
                                    handleCustomFieldUpdate(
                                        item.id,
                                        {
                                            pageCount: item.pageCount,
                                            printMode: item.printMode,
                                            pageSize: item.pageSize,
                                            paperType: item.paperType,
                                            bindingType: item.bindingType,
                                        },
                                        { title: e.target.value },
                                    )
                                }
                            />
                            <div className="cart-badges">
                                <span className={`badge ${item.printMode}`}>{item.printMode.toUpperCase()}</span>
                                <span className="badge pages">{item.pageCount} Pages</span>
                                <span className="badge pages">Custom</span>
                            </div>
                            <div className="custom-item-edit-grid">
                                <input
                                    type="number"
                                    min={1}
                                    value={item.pageCount}
                                    onChange={(e) =>
                                        handleCustomFieldUpdate(
                                            item.id,
                                            {
                                                pageCount: item.pageCount,
                                                printMode: item.printMode,
                                                pageSize: item.pageSize,
                                                paperType: item.paperType,
                                                bindingType: item.bindingType,
                                            },
                                            { pageCount: Math.max(1, Number(e.target.value) || 1) },
                                        )
                                    }
                                />
                                <select
                                    value={item.printMode}
                                    onChange={(e) =>
                                        handleCustomFieldUpdate(
                                            item.id,
                                            {
                                                pageCount: item.pageCount,
                                                printMode: item.printMode,
                                                pageSize: item.pageSize,
                                                paperType: item.paperType,
                                                bindingType: item.bindingType,
                                            },
                                            { printMode: e.target.value as 'color' | 'bw' },
                                        )
                                    }
                                >
                                    <option value="bw">B&W</option>
                                    <option value="color">Color</option>
                                </select>
                                <select
                                    value={item.pageSize}
                                    onChange={(e) =>
                                        handleCustomFieldUpdate(
                                            item.id,
                                            {
                                                pageCount: item.pageCount,
                                                printMode: item.printMode,
                                                pageSize: item.pageSize,
                                                paperType: item.paperType,
                                                bindingType: item.bindingType,
                                            },
                                            { pageSize: e.target.value },
                                        )
                                    }
                                >
                                    {Object.keys(pricingSettings.sizeMultipliers).map((size) => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={item.paperType}
                                    onChange={(e) =>
                                        handleCustomFieldUpdate(
                                            item.id,
                                            {
                                                pageCount: item.pageCount,
                                                printMode: item.printMode,
                                                pageSize: item.pageSize,
                                                paperType: item.paperType,
                                                bindingType: item.bindingType,
                                            },
                                            { paperType: e.target.value },
                                        )
                                    }
                                >
                                    {Object.keys(pricingSettings.paperMultipliers).map((paperType) => (
                                        <option key={paperType} value={paperType}>
                                            {paperType}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={item.bindingType}
                                    onChange={(e) =>
                                        handleCustomFieldUpdate(
                                            item.id,
                                            {
                                                pageCount: item.pageCount,
                                                printMode: item.printMode,
                                                pageSize: item.pageSize,
                                                paperType: item.paperType,
                                                bindingType: item.bindingType,
                                            },
                                            { bindingType: e.target.value },
                                        )
                                    }
                                >
                                    {Object.keys(pricingSettings.bindingCharges).map((binding) => (
                                        <option key={binding} value={binding}>
                                            {binding}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="cart-price">
                                ₹{item.unitPrice} x {item.quantity} = ₹{item.unitPrice * item.quantity}
                            </div>
                        </div>
                        <div className="cart-actions">
                            <div className="qty-controls">
                                <button onClick={() => updateCustomQuantity(item.id, -1)}>-</button>
                                <span>{item.quantity}</span>
                                <button onClick={() => updateCustomQuantity(item.id, 1)}>+</button>
                            </div>
                            <button className="delete-btn" onClick={() => removeCustomFromCart(item.id)}>
                                🗑
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="checkout-summary glass-panel">
                <div className="summary-row">
                    <span>Books Total</span>
                    <span>₹{totals.price}</span>
                </div>
                <div className="summary-row">
                    <span>Total Weight</span>
                    <span>{(totals.weight / 1000).toFixed(2)} kg</span>
                </div>

                <div className="adjustment-section">
                    <h4>Discount / Markup</h4>
                    <div className="adjustment-controls">
                        <div className="adjustment-toggle">
                            <button
                                className={`adj-btn ${adjustmentType === 'discount' ? 'active discount-active' : ''}`}
                                onClick={() => setAdjustmentType('discount')}
                            >
                                Discount
                            </button>
                            <button
                                className={`adj-btn ${adjustmentType === 'markup' ? 'active markup-active' : ''}`}
                                onClick={() => setAdjustmentType('markup')}
                            >
                                Markup
                            </button>
                        </div>
                        <div className="adjustment-input">
                            <span className="rupee-prefix">₹</span>
                            <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={adjustment || ''}
                                onChange={(e) => setAdjustment(Math.max(0, Number(e.target.value)))}
                            />
                        </div>
                    </div>
                    {adjustment > 0 && (
                        <div className={`adjustment-preview ${adjustmentType}`}>
                            {adjustmentType === 'discount'
                                ? `₹${adjustment} discount applied`
                                : `₹${adjustment} added to delivery charge`}
                        </div>
                    )}
                </div>

                <div className="shipping-section">
                    <h4>Estimate Shipping</h4>
                    <div className="pincode-input">
                        <input
                            type="text"
                            placeholder="Pincode"
                            maxLength={6}
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        />
                        <button onClick={handleCalculateShipping} disabled={loadingQuote}>
                            {loadingQuote ? '...' : 'Check'}
                        </button>
                    </div>
                    {error && <p className="error-text">{error}</p>}

                    {activeCourier && (
                        <div className="shipping-quote-result">
                            <div className="summary-row shipping">
                                <span className="shipping-label">
                                    Shipping ({activeCourier.courierName})
                                    {shippingQuote && shippingQuote.allOptions.length > 1 && (
                                        <button className="change-courier-btn" onClick={() => setShowCourierModal(true)}>
                                            Change
                                        </button>
                                    )}
                                </span>
                                <span>+₹{effectiveShippingDisplay()}</span>
                            </div>
                            {adjustmentType === 'discount' && adjustment > 0 && (
                                <div className="summary-row discount-row">
                                    <span>Discount</span>
                                    <span>-₹{adjustment}</span>
                                </div>
                            )}
                            <div className="divider"></div>
                            <div className="summary-row grand-total">
                                <span>Grand Total</span>
                                <span>₹{computeGrandTotal()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="message-template-row">
                    <label>Message Template</label>
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                        <option value="">Use auto quote message</option>
                        {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.title}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="share-buttons">
                    <button className="share-btn whatsapp" onClick={shareWhatsApp}>
                        Share on WhatsApp
                    </button>
                    <button className="share-btn telegram" onClick={shareTelegram}>
                        Share on Telegram
                    </button>
                </div>

                <button
                    className="create-order-btn"
                    onClick={() => {
                        const catalogItems: OrderItem[] = catalogCartItems.map(({ book, variant, quantity }) => ({
                            itemType: 'catalog',
                            bookId: book.id,
                            title: book.title,
                            variant,
                            quantity,
                            unitPrice: variant === 'color' ? book.priceColor : book.priceBW,
                            pageCount: book.pageCount,
                        }));

                        const customItems: OrderItem[] = customCart.map((item) => ({
                            itemType: 'custom',
                            bookId: item.id,
                            title: item.title,
                            variant: item.printMode,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            pageCount: item.pageCount,
                            customConfig: {
                                printMode: item.printMode,
                                pageSize: item.pageSize,
                                paperType: item.paperType,
                                bindingType: item.bindingType,
                            },
                        }));

                        onCreateOrder({
                            items: [...catalogItems, ...customItems],
                            booksTotal: totals.price,
                            shippingCharge: activeCourier?.price || 0,
                            courierName: activeCourier?.courierName || 'TBD',
                            selectedCourierId: activeCourier?.courierId,
                            adjustment,
                            adjustmentType,
                            grandTotal: computeGrandTotal(),
                            weightGrams: totals.weight,
                        });
                    }}
                >
                    Next → Create / Resume Draft
                </button>
            </div>

            <CourierModal
                isOpen={showCourierModal}
                onClose={() => setShowCourierModal(false)}
                quotes={shippingQuote!}
                selectedCourier={selectedCourier}
                onSelect={(opt) => {
                    setSelectedCourier(opt);
                    setShowCourierModal(false);
                }}
            />
        </div>
    );
};

export default CartPage;

