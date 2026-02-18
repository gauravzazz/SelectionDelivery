import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface PrintPricingSettings {
    bwPageRate: number;
    colorPageRate: number;
    sizeMultipliers: Record<string, number>;
    paperMultipliers: Record<string, number>;
    bindingCharges: Record<string, number>;
    minOrderCharge: number;
    packagingCharge: number;
    baseWeightBySize: Record<string, number>;
    bindingWeightGrams: Record<string, number>;
    packagingWeightGrams: number;
    defaultPageSize: string;
    defaultPaperType: string;
    defaultBindingType: string;
}

const COLLECTION_NAME = 'app_settings';
const DOC_ID = 'pricing';

export const DEFAULT_PRICING_SETTINGS: PrintPricingSettings = {
    bwPageRate: 1.2,
    colorPageRate: 6,
    sizeMultipliers: {
        A4: 1,
        A3: 1.9,
        A5: 0.75,
        Letter: 1,
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
    defaultPaperType: 'standard',
    defaultBindingType: 'spiral',
};

function sanitizeSettings(raw: Partial<PrintPricingSettings> | undefined): PrintPricingSettings {
    if (!raw) return DEFAULT_PRICING_SETTINGS;
    return {
        ...DEFAULT_PRICING_SETTINGS,
        ...raw,
        sizeMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.sizeMultipliers,
            ...(raw.sizeMultipliers || {}),
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
    };
}

export const SettingsService = {
    async getPricingSettings(): Promise<PrintPricingSettings> {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
            await setDoc(ref, DEFAULT_PRICING_SETTINGS);
            return DEFAULT_PRICING_SETTINGS;
        }

        return sanitizeSettings(snapshot.data() as Partial<PrintPricingSettings>);
    },

    async savePricingSettings(settings: PrintPricingSettings): Promise<void> {
        const ref = doc(db, COLLECTION_NAME, DOC_ID);
        const sanitized = sanitizeSettings(settings);
        await setDoc(ref, sanitized);
    },
};

