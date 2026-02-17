import React from 'react';
import './ShippingForm.css';
import { CourierInfo } from '../api/shippingApi';
import { WeightResult } from '../engine/weightCalculator';

interface ShippingFormProps {
    pageSizes: string[];
    gsmOptions: string[];
    bindingTypes: string[];
    packagingTypes: string[];
    couriers: CourierInfo[];
    weight: WeightResult | null;
    loading: boolean;
    onSubmit: (data: FormData) => void;
    onFieldChange: (field: string, value: string | number) => void;
}

export interface FormData {
    destinationPincode: string;
    pageCount: number;
    pageSize: string;
    gsm: string;
    printSide: 'single' | 'double';
    bindingType: string;
    packagingType: string;
    selectedCouriers: string[];
}

const ShippingForm: React.FC<ShippingFormProps> = ({
    pageSizes,
    gsmOptions,
    bindingTypes,
    packagingTypes,
    couriers,
    weight,
    loading,
    onSubmit,
    onFieldChange,
}) => {
    const [form, setForm] = React.useState<FormData>({
        destinationPincode: '',
        pageCount: 10,
        pageSize: pageSizes[0] || 'A4',
        gsm: gsmOptions[1] || '80',
        printSide: 'double',
        bindingType: bindingTypes[0] || 'none',
        packagingType: 'standard',
        selectedCouriers: couriers.filter((c) => c.enabled).map((c) => c.id),
    });

    const updateField = (field: keyof FormData, value: string | number | string[]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (typeof value !== 'object') {
            onFieldChange(field, value);
        }
    };

    const toggleCourier = (id: string) => {
        setForm((prev) => {
            const next = prev.selectedCouriers.includes(id)
                ? prev.selectedCouriers.filter((c) => c !== id)
                : [...prev.selectedCouriers, id];
            return { ...prev, selectedCouriers: next };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(form);
    };

    const formatLabel = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

    return (
        <form className="shipping-form" onSubmit={handleSubmit}>
            <div className="form-header">
                <div className="form-icon">📦</div>
                <h1 className="form-title">PrintShip</h1>
                <p className="form-subtitle">Smart shipping calculator for print orders</p>
            </div>

            {/* Destination */}
            <div className="field-group">
                <label className="field-label">Destination Pincode</label>
                <input
                    id="destinationPincode"
                    className="field-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="e.g. 400001"
                    value={form.destinationPincode}
                    onChange={(e) => updateField('destinationPincode', e.target.value.replace(/\D/g, ''))}
                    required
                />
            </div>

            {/* Pages + Print Side */}
            <div className="field-row">
                <div className="field-group flex-1">
                    <label className="field-label">Page Count</label>
                    <input
                        id="pageCount"
                        className="field-input"
                        type="number"
                        min={1}
                        value={form.pageCount}
                        onChange={(e) => updateField('pageCount', Math.max(1, parseInt(e.target.value) || 1))}
                        required
                    />
                </div>
                <div className="field-group flex-1">
                    <label className="field-label">Print Side</label>
                    <div className="toggle-group">
                        <button
                            type="button"
                            className={`toggle-btn ${form.printSide === 'double' ? 'active' : ''}`}
                            onClick={() => updateField('printSide', 'double')}
                        >
                            Double
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${form.printSide === 'single' ? 'active' : ''}`}
                            onClick={() => updateField('printSide', 'single')}
                        >
                            Single
                        </button>
                    </div>
                </div>
            </div>

            {/* Page Size + GSM */}
            <div className="field-row">
                <div className="field-group flex-1">
                    <label className="field-label">Page Size</label>
                    <select
                        id="pageSize"
                        className="field-select"
                        value={form.pageSize}
                        onChange={(e) => updateField('pageSize', e.target.value)}
                    >
                        {pageSizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="field-group flex-1">
                    <label className="field-label">Paper GSM</label>
                    <select
                        id="gsm"
                        className="field-select"
                        value={form.gsm}
                        onChange={(e) => updateField('gsm', e.target.value)}
                    >
                        {gsmOptions.map((g) => (
                            <option key={g} value={g}>{g} GSM</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Binding */}
            <div className="field-group">
                <label className="field-label">Binding Type</label>
                <div className="chip-group">
                    {bindingTypes.map((b) => (
                        <button
                            key={b}
                            type="button"
                            className={`chip ${form.bindingType === b ? 'active' : ''}`}
                            onClick={() => updateField('bindingType', b)}
                        >
                            {formatLabel(b)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Packaging */}
            <div className="field-group">
                <label className="field-label">Packaging</label>
                <div className="chip-group">
                    {packagingTypes.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`chip ${form.packagingType === p ? 'active' : ''}`}
                            onClick={() => updateField('packagingType', p)}
                        >
                            {formatLabel(p)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Courier Filter */}
            <div className="field-group">
                <label className="field-label">Couriers to Check</label>
                <div className="chip-group">
                    {couriers.filter((c) => c.enabled).map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={`chip courier-chip ${form.selectedCouriers.includes(c.id) ? 'active' : ''}`}
                            onClick={() => toggleCourier(c.id)}
                        >
                            {form.selectedCouriers.includes(c.id) ? '✓ ' : ''}{c.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Live Weight Preview */}
            {weight && weight.totalWeightGrams > 0 && (
                <div className="weight-preview">
                    <div className="weight-preview-header">
                        <span className="weight-icon">⚖️</span>
                        <span className="weight-label">Estimated Weight</span>
                    </div>
                    <div className="weight-breakdown">
                        <div className="weight-row">
                            <span>Paper ({weight.physicalSheets} sheets)</span>
                            <span>{weight.paperWeightGrams.toFixed(0)}g</span>
                        </div>
                        {weight.bindingWeightGrams > 0 && (
                            <div className="weight-row">
                                <span>Binding</span>
                                <span>{weight.bindingWeightGrams}g</span>
                            </div>
                        )}
                        <div className="weight-row">
                            <span>Packaging</span>
                            <span>{weight.packagingWeightGrams}g</span>
                        </div>
                        <div className="weight-row weight-total">
                            <span>Total</span>
                            <span>{weight.totalWeightGrams.toFixed(0)}g</span>
                        </div>
                    </div>
                </div>
            )}

            <button
                id="submitQuote"
                type="submit"
                className="submit-btn"
                disabled={loading || form.destinationPincode.length !== 6 || form.selectedCouriers.length === 0}
            >
                {loading ? (
                    <span className="btn-spinner" />
                ) : (
                    <>Get Shipping Quotes</>
                )}
            </button>
        </form>
    );
};

export default ShippingForm;
