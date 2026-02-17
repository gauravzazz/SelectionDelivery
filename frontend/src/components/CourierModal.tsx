import React from 'react';
import { QuoteResponse, ShippingOption } from '../api/shippingApi';
import './CartPage.css'; // Reusing styles for now

interface CourierModalProps {
    isOpen: boolean;
    onClose: () => void;
    quotes: QuoteResponse;
    selectedCourier: ShippingOption | null;
    onSelect: (option: ShippingOption) => void;
    onConfirm?: () => void; // Optional confirm action
    confirmLabel?: string;
}

const CourierModal: React.FC<CourierModalProps> = ({
    isOpen,
    onClose,
    quotes,
    selectedCourier,
    onSelect,
    onConfirm,
    confirmLabel = "Confirm"
}) => {
    if (!isOpen || !quotes) return null;

    return (
        <div className="courier-modal-overlay" onClick={onClose}>
            <div className="courier-modal glass-panel" onClick={e => e.stopPropagation()}>
                <div className="courier-modal-header">
                    <h3>Select Courier</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="courier-list">
                    {[...quotes.allOptions]
                        .sort((a, b) => {
                            const isACheapest = quotes.cheapest?.courierId === a.courierId && quotes.cheapest?.price === a.price;
                            const isAFastest = quotes.fastest?.courierId === a.courierId && quotes.fastest?.deliveryDays === a.deliveryDays;
                            const isBCheapest = quotes.cheapest?.courierId === b.courierId && quotes.cheapest?.price === b.price;
                            const isBFastest = quotes.fastest?.courierId === b.courierId && quotes.fastest?.deliveryDays === b.deliveryDays;

                            const aPriority = isACheapest || isAFastest;
                            const bPriority = isBCheapest || isBFastest;

                            if (aPriority && !bPriority) return -1;
                            if (!aPriority && bPriority) return 1;

                            return a.price - b.price;
                        })
                        .map((opt) => {
                            const isCheapest = quotes.cheapest?.courierId === opt.courierId && quotes.cheapest?.price === opt.price;
                            const isFastest = quotes.fastest?.courierId === opt.courierId && quotes.fastest?.deliveryDays === opt.deliveryDays;
                            const isSelected = selectedCourier?.courierId === opt.courierId && selectedCourier?.price === opt.price;

                            return (
                                <div
                                    key={`${opt.courierId}-${opt.storePincode}`}
                                    className={`courier-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => onSelect(opt)}
                                >
                                    <div className="courier-info">
                                        <div className="courier-name-row">
                                            <span className="courier-name">{opt.courierName}</span>
                                            {isCheapest && <span className="badge cheap">Cheapest</span>}
                                            {isFastest && <span className="badge fast">Fastest</span>}
                                        </div>
                                        <div className="courier-meta">
                                            {opt.deliveryDays} Day(s) • via {opt.storeName}
                                        </div>
                                    </div>
                                    <div className="courier-price">₹{opt.price}</div>
                                </div>
                            );
                        })}
                </div>
                {onConfirm && selectedCourier && (
                    <div className="modal-actions">
                        <button className="confirm-btn" onClick={onConfirm}>
                            {confirmLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourierModal;
