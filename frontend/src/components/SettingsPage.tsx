import React, { useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_PRICING_SETTINGS,
    PrintPricingSettings,
    SettingsService,
} from '../api/settingsApi';
import './SettingsPage.css';

const toNumber = (value: string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<PrintPricingSettings>(DEFAULT_PRICING_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string>('');
    const [syncMessage, setSyncMessage] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SettingsService.getPricingSettings();
                setSettings(data);
            } catch (error) {
                console.error('Failed to load settings', error);
                setSyncMessage({
                    type: 'warn',
                    text: 'Could not load from backend. Using local/default settings.',
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const sizes = useMemo(
        () => Array.from(new Set([...Object.keys(settings.bwRatesBySizeGsm), ...Object.keys(settings.colorRatesBySizeGsm)])),
        [settings.bwRatesBySizeGsm, settings.colorRatesBySizeGsm],
    );

    const setMapNumber = (
        key: 'paperMultipliers' | 'bindingCharges' | 'bindingWeightGrams',
        mapKey: string,
        value: string,
    ) => {
        setSettings((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [mapKey]: toNumber(value),
            },
        }));
    };

    const setRateMatrixNumber = (
        key: 'bwRatesBySizeGsm' | 'colorRatesBySizeGsm' | 'sheetWeightBySizeGsm',
        size: string,
        gsm: string,
        value: string,
    ) => {
        setSettings((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [size]: {
                    ...(prev[key]?.[size] || {}),
                    [gsm]: toNumber(value),
                },
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await SettingsService.savePricingSettings(settings);
            setSavedAt(new Date().toLocaleString('en-IN'));
            if (result.storage === 'backend') {
                setSyncMessage({ type: 'ok', text: 'Settings saved to backend and local cache.' });
            } else {
                setSyncMessage({
                    type: 'warn',
                    text: result.warning || 'Settings saved locally only.',
                });
            }
        } catch (error) {
            console.error('Failed to save settings', error);
            setSyncMessage({ type: 'error', text: 'Failed to save settings. Please retry.' });
        } finally {
            setSaving(false);
        }
    };

    const renderRateMatrix = (
        title: string,
        key: 'bwRatesBySizeGsm' | 'colorRatesBySizeGsm' | 'sheetWeightBySizeGsm',
    ) => (
        <div className="settings-card glass-panel">
            <h4>{title}</h4>
            <div className="rate-matrix-wrap">
                <table className="rate-matrix-table">
                    <thead>
                        <tr>
                            <th>Size</th>
                            {settings.gsmOptions.map((gsm) => (
                                <th key={`${key}-head-${gsm}`}>{gsm} GSM</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sizes.map((size) => (
                            <tr key={`${key}-${size}`}>
                                <td>{size}</td>
                                {settings.gsmOptions.map((gsm) => (
                                    <td key={`${key}-${size}-${gsm}`}>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={settings[key]?.[size]?.[gsm] ?? 0}
                                            onChange={(e) => setRateMatrixNumber(key, size, gsm, e.target.value)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderMapEditor = (
        title: string,
        key: 'paperMultipliers' | 'bindingCharges' | 'bindingWeightGrams',
    ) => (
        <div className="settings-card glass-panel">
            <h4>{title}</h4>
            <div className="settings-grid">
                {Object.entries(settings[key]).map(([entryKey, entryValue]) => (
                    <label key={`${String(key)}-${entryKey}`} className="settings-field">
                        <span>{entryKey}</span>
                        <input
                            type="number"
                            step="0.01"
                            value={entryValue}
                            onChange={(e) => setMapNumber(key, entryKey, e.target.value)}
                        />
                    </label>
                ))}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-loading">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div>
                    <h3>Print Pricing Settings</h3>
                    <p>Matrix-based pricing on top. Simplified controls for mobile usage.</p>
                </div>
                <div className="settings-header-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setSettings(DEFAULT_PRICING_SETTINGS)}
                        disabled={saving}
                    >
                        Reset Defaults
                    </button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {savedAt && <div className="save-meta">Last saved: {savedAt}</div>}
            {syncMessage && <div className={`sync-message ${syncMessage.type}`}>{syncMessage.text}</div>}

            {renderRateMatrix('B&W Rate Matrix (Size x GSM)', 'bwRatesBySizeGsm')}
            {renderRateMatrix('Color Rate Matrix (Size x GSM)', 'colorRatesBySizeGsm')}
            {renderRateMatrix('Sheet Weight Matrix (grams/sheet)', 'sheetWeightBySizeGsm')}

            <div className="settings-card glass-panel">
                <h4>Charges</h4>
                <div className="settings-grid">
                    <label className="settings-field">
                        <span>Minimum order charge (₹)</span>
                        <input
                            type="number"
                            step="1"
                            value={settings.minOrderCharge}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, minOrderCharge: toNumber(e.target.value) }))
                            }
                        />
                    </label>
                    <label className="settings-field">
                        <span>Packaging charge (₹)</span>
                        <input
                            type="number"
                            step="1"
                            value={settings.packagingCharge}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, packagingCharge: toNumber(e.target.value) }))
                            }
                        />
                    </label>
                    <label className="settings-field">
                        <span>Packaging weight (grams)</span>
                        <input
                            type="number"
                            step="1"
                            value={settings.packagingWeightGrams}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, packagingWeightGrams: toNumber(e.target.value) }))
                            }
                        />
                    </label>
                </div>
            </div>

            {renderMapEditor('Paper Multipliers', 'paperMultipliers')}
            {renderMapEditor('Binding Charges (₹)', 'bindingCharges')}
            {renderMapEditor('Binding Weight (grams)', 'bindingWeightGrams')}

            <div className="settings-card glass-panel">
                <h4>Defaults for New Custom Jobs</h4>
                <div className="settings-grid">
                    <label className="settings-field">
                        <span>Default page size</span>
                        <select
                            value={settings.defaultPageSize}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, defaultPageSize: e.target.value }))
                            }
                        >
                            {sizes.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="settings-field">
                        <span>Default GSM</span>
                        <select
                            value={settings.defaultGsm}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, defaultGsm: e.target.value }))
                            }
                        >
                            {settings.gsmOptions.map((gsm) => (
                                <option key={gsm} value={gsm}>
                                    {gsm} GSM
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="settings-field">
                        <span>Default paper type</span>
                        <select
                            value={settings.defaultPaperType}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, defaultPaperType: e.target.value }))
                            }
                        >
                            {Object.keys(settings.paperMultipliers).map((paper) => (
                                <option key={paper} value={paper}>
                                    {paper}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="settings-field">
                        <span>Default binding type</span>
                        <select
                            value={settings.defaultBindingType}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, defaultBindingType: e.target.value }))
                            }
                        >
                            {Object.keys(settings.bindingCharges).map((binding) => (
                                <option key={binding} value={binding}>
                                    {binding}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;

