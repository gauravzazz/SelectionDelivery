import React, { useEffect, useState } from 'react';
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

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SettingsService.getPricingSettings();
                setSettings(data);
            } catch (error) {
                console.error('Failed to load settings', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const setMapNumber = (
        key: keyof Pick<
            PrintPricingSettings,
            'sizeMultipliers' | 'paperMultipliers' | 'bindingCharges' | 'baseWeightBySize' | 'bindingWeightGrams'
        >,
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

    const handleSave = async () => {
        setSaving(true);
        try {
            await SettingsService.savePricingSettings(settings);
            setSavedAt(new Date().toLocaleString('en-IN'));
        } catch (error) {
            console.error('Failed to save settings', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const renderMapEditor = (
        title: string,
        key: keyof Pick<
            PrintPricingSettings,
            'sizeMultipliers' | 'paperMultipliers' | 'bindingCharges' | 'baseWeightBySize' | 'bindingWeightGrams'
        >,
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
                    <p>Used for custom print job pricing and shipping weight estimates.</p>
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

            <div className="settings-card glass-panel">
                <h4>Base Pricing</h4>
                <div className="settings-grid">
                    <label className="settings-field">
                        <span>B&W per page (₹)</span>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.bwPageRate}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, bwPageRate: toNumber(e.target.value) }))
                            }
                        />
                    </label>
                    <label className="settings-field">
                        <span>Color per page (₹)</span>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.colorPageRate}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, colorPageRate: toNumber(e.target.value) }))
                            }
                        />
                    </label>
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

            {renderMapEditor('Size Multipliers', 'sizeMultipliers')}
            {renderMapEditor('Paper Multipliers', 'paperMultipliers')}
            {renderMapEditor('Binding Charges (₹)', 'bindingCharges')}
            {renderMapEditor('Base Weight By Size (grams/sheet)', 'baseWeightBySize')}
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
                            {Object.keys(settings.sizeMultipliers).map((size) => (
                                <option key={size} value={size}>
                                    {size}
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

