import { Router } from 'express';
import { db } from '../firebase';

const router = Router();

interface PricingSettings {
    gsmOptions: string[];
    bwRatesBySizeGsm: Record<string, Record<string, number>>;
    colorRatesBySizeGsm: Record<string, Record<string, number>>;
    sheetWeightBySizeGsm: Record<string, Record<string, number>>;
    paperMultipliers: Record<string, number>;
    bindingCharges: Record<string, number>;
    minOrderCharge: number;
    packagingCharge: number;
    bindingWeightGrams: Record<string, number>;
    packagingWeightGrams: number;
    defaultPageSize: string;
    defaultGsm: string;
    defaultPaperType: string;
    defaultBindingType: string;
}

const DEFAULT_PRICING_SETTINGS: PricingSettings = {
    gsmOptions: ['75', '80', '100', '130'],
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
    sheetWeightBySizeGsm: {
        A4: { '75': 4.8, '80': 5, '100': 6.2, '130': 8.0 },
        A3: { '75': 7.7, '80': 8, '100': 10.0, '130': 12.8 },
        A5: { '75': 2.9, '80': 3, '100': 3.8, '130': 4.8 },
        Letter: { '75': 4.8, '80': 5, '100': 6.2, '130': 8.0 },
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

const COLLECTION = 'app_settings';
const DOC_ID = 'pricing';

router.get('/pricing', async (_req, res): Promise<void> => {
    try {
        const ref = db.collection(COLLECTION).doc(DOC_ID);
        const snap = await ref.get();

        if (!snap.exists) {
            await ref.set(DEFAULT_PRICING_SETTINGS);
            res.json(DEFAULT_PRICING_SETTINGS);
            return;
        }

        res.json(snap.data());
    } catch (error: any) {
        console.error('Failed to load pricing settings:', error);
        res.status(500).json({ error: error.message || 'Failed to load settings' });
    }
});

router.put('/pricing', async (req, res): Promise<void> => {
    try {
        const incoming = req.body as Partial<PricingSettings>;
        if (!incoming || typeof incoming !== 'object') {
            res.status(400).json({ error: 'Invalid settings payload' });
            return;
        }

        const next = {
            ...DEFAULT_PRICING_SETTINGS,
            ...incoming,
            bwRatesBySizeGsm: incoming.bwRatesBySizeGsm || DEFAULT_PRICING_SETTINGS.bwRatesBySizeGsm,
            colorRatesBySizeGsm: incoming.colorRatesBySizeGsm || DEFAULT_PRICING_SETTINGS.colorRatesBySizeGsm,
            sheetWeightBySizeGsm: incoming.sheetWeightBySizeGsm || DEFAULT_PRICING_SETTINGS.sheetWeightBySizeGsm,
            paperMultipliers: incoming.paperMultipliers || DEFAULT_PRICING_SETTINGS.paperMultipliers,
            bindingCharges: incoming.bindingCharges || DEFAULT_PRICING_SETTINGS.bindingCharges,
            bindingWeightGrams: incoming.bindingWeightGrams || DEFAULT_PRICING_SETTINGS.bindingWeightGrams,
            updatedAt: new Date().toISOString(),
        };

        const ref = db.collection(COLLECTION).doc(DOC_ID);
        await ref.set(next);
        res.json({ success: true, settings: next });
    } catch (error: any) {
        console.error('Failed to save pricing settings:', error);
        res.status(500).json({ error: error.message || 'Failed to save settings' });
    }
});

export default router;

