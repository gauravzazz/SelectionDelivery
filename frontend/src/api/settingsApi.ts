import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface PrintPricingSettings {
    bwPageRate: number;
    colorPageRate: number;
    sizeMultipliers: Record<string, number>;
    gsmOptions: string[];
    gsmPriceMultipliers: Record<string, number>;
    gsmWeightMultipliers: Record<string, number>;
    bwRatesBySizeGsm: Record<string, Record<string, number>>;
    colorRatesBySizeGsm: Record<string, Record<string, number>>;
    paperMultipliers: Record<string, number>;
    bindingCharges: Record<string, number>;
    minOrderCharge: number;
    packagingCharge: number;
    baseWeightBySize: Record<string, number>;
    bindingWeightGrams: Record<string, number>;
    packagingWeightGrams: number;
    defaultPageSize: string;
    defaultGsm: string;
    defaultPaperType: string;
    defaultBindingType: string;
}

const COLLECTION_NAME = 'app_settings';
const DOC_ID = 'pricing';
const LOCAL_SETTINGS_KEY = 'appSettingsPricingLocal';

export const DEFAULT_PRICING_SETTINGS: PrintPricingSettings = {
    bwPageRate: 1.2,
    colorPageRate: 6,
    sizeMultipliers: {
        A4: 1,
        A3: 1.9,
        A5: 0.75,
        Letter: 1,
    },
    gsmOptions: ['75', '80', '100', '130'],
    gsmPriceMultipliers: {
        '75': 1,
        '80': 1.05,
        '100': 1.3,
        '130': 1.65,
    },
    gsmWeightMultipliers: {
        '75': 0.95,
        '80': 1,
        '100': 1.25,
        '130': 1.6,
    },
    bwRatesBySizeGsm: {
        A4: { '75': 1.2, '80': 1.3, '100': 1.6, '130': 2.0 },
        A3: { '75': 2.2, '80': 2.4, '100': 3.1, '130': 4.0 },
        A5: { '75': 1.0, '80': 1.1, '100': 1.4, '130': 1.8 },
        Letter: { '75': 1.2, '80': 1.3, '100': 1.6, '130': 2.0 },
    },
    colorRatesBySizeGsm: {
        A4: { '75': 6.0, '80': 6.4, '100': 7.6, '130': 9.2 },
        A3: { '75': 10.8, '80': 11.6, '100': 13.8, '130': 16.6 },
        A5: { '75': 4.8, '80': 5.1, '100': 6.2, '130': 7.5 },
        Letter: { '75': 6.0, '80': 6.4, '100': 7.6, '130': 9.2 },
    },
    paperMultipliers: {
        standard: 1,
        premium: 1.3,
        glossy: 1.55,
    },
    bindingCharges: {
        none: 0,
        spiral: 25,
        perfect: 45,
        hardbound: 120,
    },
    minOrderCharge: 20,
    packagingCharge: 10,
    baseWeightBySize: {
        A4: 5,
        A3: 8,
        A5: 3,
        Letter: 5,
    },
    bindingWeightGrams: {
        none: 0,
        spiral: 120,
        perfect: 180,
        hardbound: 350,
    },
    packagingWeightGrams: 150,
    defaultPageSize: 'A4',
    defaultGsm: '80',
    defaultPaperType: 'standard',
    defaultBindingType: 'spiral',
};

function uniqueKeys(values: string[]): string[] {
    return Array.from(new Set(values));
}

function round2(value: number): number {
    return Number(value.toFixed(2));
}

function extractMatrixGsmKeys(matrix?: Record<string, Record<string, number>>): string[] {
    if (!matrix) return [];
    return Object.values(matrix).flatMap((row) => Object.keys(row || {}));
}

function mergeRatesMatrix(
    rawMatrix: Record<string, Record<string, number>> | undefined,
    fallbackMatrix: Record<string, Record<string, number>>,
    sizes: string[],
    gsms: string[],
): Record<string, Record<string, number>> {
    const next: Record<string, Record<string, number>> = {};
    for (const size of sizes) {
        next[size] = {};
        for (const gsm of gsms) {
            const rawValue = rawMatrix?.[size]?.[gsm];
            const fallbackValue = fallbackMatrix[size]?.[gsm];
            next[size][gsm] = Number.isFinite(rawValue) ? Number(rawValue) : Number(fallbackValue ?? 0);
        }
    }
    return next;
}

function sanitizeSettings(raw: Partial<PrintPricingSettings> | undefined): PrintPricingSettings {
    if (!raw) return DEFAULT_PRICING_SETTINGS;
    const mergedBase: PrintPricingSettings = {
        ...DEFAULT_PRICING_SETTINGS,
        ...raw,
        sizeMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.sizeMultipliers,
            ...(raw.sizeMultipliers || {}),
        },
        gsmPriceMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.gsmPriceMultipliers,
            ...(raw.gsmPriceMultipliers || {}),
        },
        gsmWeightMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.gsmWeightMultipliers,
            ...(raw.gsmWeightMultipliers || {}),
        },
        paperMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.paperMultipliers,
            ...(raw.paperMultipliers || {}),
        },
        bindingCharges: {
            ...DEFAULT_PRICING_SETTINGS.bindingCharges,
            ...(raw.bindingCharges || {}),
        },
        baseWeightBySize: {
            ...DEFAULT_PRICING_SETTINGS.baseWeightBySize,
            ...(raw.baseWeightBySize || {}),
        },
        bindingWeightGrams: {
            ...DEFAULT_PRICING_SETTINGS.bindingWeightGrams,
            ...(raw.bindingWeightGrams || {}),
        },
        bwRatesBySizeGsm: raw.bwRatesBySizeGsm || DEFAULT_PRICING_SETTINGS.bwRatesBySizeGsm,
        colorRatesBySizeGsm: raw.colorRatesBySizeGsm || DEFAULT_PRICING_SETTINGS.colorRatesBySizeGsm,
        gsmOptions: raw.gsmOptions || DEFAULT_PRICING_SETTINGS.gsmOptions,
    };

    const sizes = uniqueKeys([
        ...Object.keys(mergedBase.sizeMultipliers),
        ...Object.keys(mergedBase.baseWeightBySize),
        ...Object.keys(mergedBase.bwRatesBySizeGsm || {}),
        ...Object.keys(mergedBase.colorRatesBySizeGsm || {}),
    ]);

    const gsms = uniqueKeys([
        ...DEFAULT_PRICING_SETTINGS.gsmOptions,
        ...(mergedBase.gsmOptions || []).map((gsm) => String(gsm)),
        ...Object.keys(mergedBase.gsmPriceMultipliers),
        ...Object.keys(mergedBase.gsmWeightMultipliers),
        ...extractMatrixGsmKeys(raw?.bwRatesBySizeGsm),
        ...extractMatrixGsmKeys(raw?.colorRatesBySizeGsm),
    ]);

    const generatedBwFallback: Record<string, Record<string, number>> = {};
    const generatedColorFallback: Record<string, Record<string, number>> = {};
    for (const size of sizes) {
        generatedBwFallback[size] = {};
        generatedColorFallback[size] = {};
        for (const gsm of gsms) {
            const sizeMultiplier = mergedBase.sizeMultipliers[size] ?? 1;
            const gsmMultiplier = mergedBase.gsmPriceMultipliers[gsm] ?? 1;
            generatedBwFallback[size][gsm] = round2(mergedBase.bwPageRate * sizeMultiplier * gsmMultiplier);
            generatedColorFallback[size][gsm] = round2(mergedBase.colorPageRate * sizeMultiplier * gsmMultiplier);
        }
    }

    const result: PrintPricingSettings = {
        ...mergedBase,
        gsmOptions: gsms,
        bwRatesBySizeGsm: mergeRatesMatrix(raw?.bwRatesBySizeGsm, generatedBwFallback, sizes, gsms),
        colorRatesBySizeGsm: mergeRatesMatrix(raw?.colorRatesBySizeGsm, generatedColorFallback, sizes, gsms),
    };

    if (!result.defaultPageSize || !sizes.includes(result.defaultPageSize)) {
        result.defaultPageSize = sizes[0] || DEFAULT_PRICING_SETTINGS.defaultPageSize;
    }
    if (!result.defaultGsm || !gsms.includes(result.defaultGsm)) {
        result.defaultGsm = gsms[0] || DEFAULT_PRICING_SETTINGS.defaultGsm;
    }

    return result;
}

function readLocalSettings(): PrintPricingSettings | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
        if (!raw) return null;
        return sanitizeSettings(JSON.parse(raw) as Partial<PrintPricingSettings>);
    } catch (_error) {
        return null;
    }
}

function writeLocalSettings(settings: PrintPricingSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (_error) {
        // Ignore storage quota/availability failures
    }
}

export interface SaveSettingsResult {
    storage: 'firebase' | 'local';
    warning?: string;
}

export const SettingsService = {
    async getPricingSettings(): Promise<PrintPricingSettings> {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const localSettings = readLocalSettings();
        try {
            const snapshot = await getDoc(ref);

            if (!snapshot.exists()) {
                await setDoc(ref, DEFAULT_PRICING_SETTINGS);
                writeLocalSettings(DEFAULT_PRICING_SETTINGS);
                return DEFAULT_PRICING_SETTINGS;
            }

            const remoteSettings = sanitizeSettings(snapshot.data() as Partial<PrintPricingSettings>);
            writeLocalSettings(remoteSettings);
            return remoteSettings;
        } catch (_error) {
            if (localSettings) return localSettings;
            return DEFAULT_PRICING_SETTINGS;
        }
    },

    async savePricingSettings(settings: PrintPricingSettings): Promise<SaveSettingsResult> {
        const sanitized = sanitizeSettings(settings);
        writeLocalSettings(sanitized);
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        try {
            await setDoc(ref, sanitized);
            return { storage: 'firebase' };
        } catch (error: any) {
            const firebaseCode = error?.code ? String(error.code) : 'unknown-error';
            return {
                storage: 'local',
                warning: `Saved locally. Firebase sync failed (${firebaseCode}). Deploy rules or check connectivity.`,
            };
        }
    },
};
