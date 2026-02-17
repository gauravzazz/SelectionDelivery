import React, { useState } from 'react';
import { useBookContext } from '../context/BookContext';
import { fetchShippingQuote, QuoteResponse } from '../api/shippingApi';
import { OrderItem } from '../api/orderApi';
import CourierModal from './CourierModal';
import './CartPage.css';

interface CartPageProps {
    onCreateOrder: (data: {
        items: OrderItem[];
        booksTotal: number;
        shippingCharge: number;
        courierName: string;
        adjustment: number;
        adjustmentType: 'discount' | 'markup';
        grandTotal: number;
        weightGrams: number;
    }) => void;
}

const CartPage: React.FC<CartPageProps> = ({ onCreateOrder }) => {
    const { cart, getCartDetails, totals, updateQuantity, removeFromCart } = useBookContext();
    const cartItems = getCartDetails();

    const [pincode, setPincode] = useState('');
    const [shippingQuote, setShippingQuote] = useState<QuoteResponse | null>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [error, setError] = useState('');
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<QuoteResponse['allOptions'][0] | null>(null);

    // Discount / Markup: positive = markup, negative = discount
    const [adjustment, setAdjustment] = useState(0);
    const [adjustmentType, setAdjustmentType] = useState<'discount' | 'markup'>('discount');

    const handleCalculateShipping = async () => {
        if (!pincode || pincode.length !== 6) {
            setError('Enter valid 6-digit pincode');
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

            // Auto-select cheapest but show modal to let user change
            if (quote.allOptions.length > 0) {
                setSelectedCourier(quote.cheapest);
                setShowCourierModal(true);
            }
        } catch (err) {
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
            // Markup is added to delivery charge
            grand += shipPrice + Math.abs(adjustment);
        } else {
            // Discount is subtracted from total
            grand += shipPrice - Math.abs(adjustment);
        }

        return Math.max(0, grand);
    };

    const effectiveShippingDisplay = () => {
        const shipPrice = activeCourier?.price || 0;
        if (adjustmentType === 'markup' && adjustment > 0) {
            return shipPrice + Math.abs(adjustment);
        }
        return shipPrice;
    };

    const generateBillMessage = () => {
        let msg = `*📚 Book Order Summary*\n\n`;
        cartItems.forEach((item, idx) => {
            const variantLabel = item.variant === 'color' ? 'Color' : 'B&W';
            const price = item.variant === 'color' ? item.book.priceColor : item.book.priceBW;
            msg += `${idx + 1}. ${item.book.title} [${variantLabel}] \n   ${item.book.pageCount}pg x ${item.quantity} = ₹${price * item.quantity}\n`;
        });

        msg += `\n*Books Total*: ₹${totals.price}`;
        msg += `\n*Weight*: ${(totals.weight / 1000).toFixed(2)} kg`;

        if (activeCourier) {
            if (adjustmentType === 'markup' && adjustment > 0) {
                msg += `\n*Shipping* (${activeCourier.courierName}): ₹${activeCourier.price + Math.abs(adjustment)}`;
            } else {
                msg += `\n*Shipping* (${activeCourier.courierName}): ₹${activeCourier.price}`;
            }

            if (adjustmentType === 'discount' && adjustment > 0) {
                msg += `\n*Discount*: -₹${Math.abs(adjustment)}`;
            }

            msg += `\n\n*GRAND TOTAL*: ₹${computeGrandTotal()}`;
        } else {
            msg += `\n*Shipping*: (Not calculated)`;

            if (adjustmentType === 'discount' && adjustment > 0) {
                msg += `\n*Discount*: -₹${Math.abs(adjustment)}`;
                msg += `\n\n*Total (Excl. Shipping)*: ₹${Math.max(0, totals.price - Math.abs(adjustment))}`;
            } else if (adjustmentType === 'markup' && adjustment > 0) {
                msg += `\n\n*Total (Excl. Shipping)*: ₹${totals.price}`;
                msg += `\n_(Markup of ₹${Math.abs(adjustment)} will be added to delivery)_`;
            } else {
                msg += `\n\n*Total (Excl. Shipping)*: ₹${totals.price}`;
            }
        }

        return encodeURIComponent(msg);
    };

    const shareWhatsApp = () => {
        window.open(`https://wa.me/?text=${generateBillMessage()}`, '_blank');
    };

    const shareTelegram = () => {
        window.open(`https://t.me/share/url?url=.&text=${generateBillMessage()}`, '_blank');
    };

    if (cart.length === 0) {
        return (
            <div className="cart-page-empty">
                <div className="empty-icon">🛒</div>
                <h2>Your cart is empty</h2>
                <p>Go back to the catalog to add some books!</p>
            </div>
        );
    }

    return (
        <div className="cart-page-container">
            <h2 className="cart-page-title">Your Order</h2>

            <div className="cart-list">
                {cartItems.map(({ book, variant, quantity }) => {
                    const unitPrice = variant === 'color' ? book.priceColor : book.priceBW;
                    return (
                        <div key={`${book.id}-${variant}`} className="cart-item-card glass-panel">
                            <div className="cart-item-info">
                                <h3>{book.title}</h3>
                                <div className="cart-badges">
                                    <span className={`badge ${variant}`}>{variant === 'color' ? 'Color' : 'B&W'}</span>
                                    <span className="badge pages">{book.pageCount} Pages</span>
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

                {/* Discount / Markup Section */}
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
                                ? `💰 ₹${adjustment} discount applied`
                                : `📦 ₹${adjustment} added to delivery charge`}
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
                            onChange={(e) => setPincode(e.target.value)}
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

                <div className="share-buttons">
                    <button className="share-btn whatsapp" onClick={shareWhatsApp}>
                        Share on WhatsApp
                    </button>
                    <button className="share-btn telegram" onClick={shareTelegram}>
                        Share on Telegram
                    </button>
                </div>

                {/* Create Order */}
                <button
                    className="create-order-btn"
                    onClick={() => {
                        const items: OrderItem[] = cartItems.map(({ book, variant, quantity }) => ({
                            bookId: book.id,
                            title: book.title,
                            variant,
                            quantity,
                            unitPrice: variant === 'color' ? book.priceColor : book.priceBW,
                            pageCount: book.pageCount,
                        }));
                        onCreateOrder({
                            items,
                            booksTotal: totals.price,
                            shippingCharge: activeCourier?.price || 0,
                            courierName: activeCourier?.courierName || 'TBD',
                            adjustment,
                            adjustmentType,
                            grandTotal: computeGrandTotal(),
                            weightGrams: totals.weight,
                        });
                    }}
                >
                    Next → Create Order
                </button>
            </div>

            {/* Courier Selection Modal */}
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
