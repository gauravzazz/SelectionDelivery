import React from 'react';
import './QuoteResults.css';
import { ShippingOption } from '../api/shippingApi';

interface QuoteResultsProps {
    cheapest: ShippingOption | null;
    fastest: ShippingOption | null;
    allOptions: ShippingOption[];
    weightGrams: number;
}

const QuoteResults: React.FC<QuoteResultsProps> = ({
    cheapest,
    fastest,
    allOptions,
    weightGrams,
}) => {
    const [showAll, setShowAll] = React.useState(false);

    if (!cheapest && !fastest) {
        return (
            <div className="results-empty">
                <div className="empty-icon">🔍</div>
                <p>No shipping options available for this route.</p>
            </div>
        );
    }

    const isSameOption =
        cheapest &&
        fastest &&
        cheapest.courierId === fastest.courierId &&
        cheapest.storePincode === fastest.storePincode;

    return (
        <div className="results-container">
            <div className="results-header">
                <h2 className="results-title">Shipping Options</h2>
                <span className="results-weight">{weightGrams}g shipment</span>
            </div>

            {/* Hero Cards */}
            <div className="hero-cards">
                {cheapest && (
                    <div className="hero-card cheapest">
                        <div className="hero-badge">💰 Cheapest</div>
                        <div className="hero-courier">{cheapest.courierName}</div>
                        <div className="hero-price">₹{cheapest.price}</div>
                        <div className="hero-meta">
                            <span>📍 {cheapest.storeName}</span>
                            <span>📅 {cheapest.deliveryDays} day{cheapest.deliveryDays > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                )}

                {fastest && !isSameOption && (
                    <div className="hero-card fastest">
                        <div className="hero-badge">⚡ Fastest</div>
                        <div className="hero-courier">{fastest.courierName}</div>
                        <div className="hero-price">₹{fastest.price}</div>
                        <div className="hero-meta">
                            <span>📍 {fastest.storeName}</span>
                            <span>📅 {fastest.deliveryDays} day{fastest.deliveryDays > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                )}

                {isSameOption && (
                    <div className="hero-card best-overall">
                        <div className="hero-badge">🏆 Best Overall</div>
                        <div className="hero-courier">{cheapest!.courierName}</div>
                        <div className="hero-price">₹{cheapest!.price}</div>
                        <div className="hero-meta">
                            <span>📍 {cheapest!.storeName}</span>
                            <span>📅 {cheapest!.deliveryDays} day{cheapest!.deliveryDays > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* All Options */}
            {allOptions.length > 2 && (
                <button
                    className="show-all-btn"
                    onClick={() => setShowAll(!showAll)}
                >
                    {showAll ? 'Hide' : 'Show'} all {allOptions.length} options
                    <span className={`chevron ${showAll ? 'open' : ''}`}>▾</span>
                </button>
            )}

            {showAll && (
                <div className="all-options">
                    {allOptions.map((opt, i) => (
                        <div key={`${opt.courierId}-${opt.storePincode}`} className="option-row" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="option-left">
                                <span className="option-courier">{opt.courierName}</span>
                                <span className="option-store">from {opt.storePincode}</span>
                            </div>
                            <div className="option-right">
                                <span className="option-price">₹{opt.price}</span>
                                <span className="option-days">{opt.deliveryDays}d</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuoteResults;
