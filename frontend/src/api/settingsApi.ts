export interface PrintPricingSettings {
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

const LOCAL_SETTINGS_KEY = 'appSettingsPricingLocal';
const DEFAULT_PROD_API_BASE = 'https://api-v4k6yqu5ia-uc.a.run.app';

export const DEFAULT_PRICING_SETTINGS: PrintPricingSettings = {
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

const unique = (values: string[]): string[] => Array.from(new Set(values));

const buildApiRoots = (raw?: string): string[] => {
    const input = (raw || (import.meta.env.DEV ? '/api' : DEFAULT_PROD_API_BASE)).replace(/\/$/, '');
    const roots = [input];
    if (input.endsWith('/api')) {
        roots.push(input.slice(0, -'/api'.length));
    } else {
        roots.push(`${input}/api`);
    }
    return unique(roots.map((root) => root.replace(/\/$/, '')));
};

const API_ROOTS = buildApiRoots(import.meta.env.VITE_API_BASE_URL);

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    for (const root of API_ROOTS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(`${root}${path}`, {
                ...(init || {}),
                signal: controller.signal,
            });
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            const isJson = contentType.includes('application/json');
            if (res.ok && isJson) return res;

            if (res.status === 404 || res.status === 405 || (res.ok && !isJson)) {
                lastResponse = res;
                continue;
            }
            return res;
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timeout);
        }
    }

    if (lastResponse) return lastResponse;
    if (lastError instanceof Error) throw lastError;
    throw new Error('Failed to reach settings API');
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
        // Ignore local storage failures.
    }
}

function matrixKeys(matrix: Record<string, Record<string, number>> | undefined): string[] {
    if (!matrix) return [];
    return Object.values(matrix).flatMap((row) => Object.keys(row || {}));
}

function buildMatrix(
    incoming: Record<string, Record<string, number>> | undefined,
    fallback: Record<string, Record<string, number>>,
    sizes: string[],
    gsms: string[],
): Record<string, Record<string, number>> {
    const next: Record<string, Record<string, number>> = {};
    for (const size of sizes) {
        next[size] = {};
        for (const gsm of gsms) {
            const value = incoming?.[size]?.[gsm];
            next[size][gsm] = Number.isFinite(value) ? Number(value) : Number(fallback[size]?.[gsm] ?? 0);
        }
    }
    return next;
}

function migrateLegacyIfNeeded(raw: any): Partial<PrintPricingSettings> {
    if (!raw || typeof raw !== 'object') return {};
    const hasMatrix = raw.bwRatesBySizeGsm && raw.colorRatesBySizeGsm;
    if (hasMatrix) return raw;

    const sizes = Object.keys(raw.sizeMultipliers || DEFAULT_PRICING_SETTINGS.bwRatesBySizeGsm);
    const gsms = unique([
        ...(raw.gsmOptions || DEFAULT_PRICING_SETTINGS.gsmOptions).map((gsm: string) => String(gsm)),
        ...Object.keys(raw.gsmPriceMultipliers || {}),
        ...Object.keys(raw.gsmWeightMultipliers || {}),
    ]);

    const bwRatesBySizeGsm: Record<string, Record<string, number>> = {};
    const colorRatesBySizeGsm: Record<string, Record<string, number>> = {};
    const sheetWeightBySizeGsm: Record<string, Record<string, number>> = {};

    for (const size of sizes) {
        bwRatesBySizeGsm[size] = {};
        colorRatesBySizeGsm[size] = {};
        sheetWeightBySizeGsm[size] = {};
        for (const gsm of gsms) {
            const sizeMultiplier = Number(raw.sizeMultipliers?.[size] ?? 1);
            const priceMul = Number(raw.gsmPriceMultipliers?.[gsm] ?? 1);
            const weightMul = Number(raw.gsmWeightMultipliers?.[gsm] ?? 1);
            const bwBase = Number(raw.bwPageRate ?? 1.2);
            const colorBase = Number(raw.colorPageRate ?? 6);
            const baseWeight = Number(raw.baseWeightBySize?.[size] ?? 5);

            bwRatesBySizeGsm[size][gsm] = Number((bwBase * sizeMultiplier * priceMul).toFixed(2));
            colorRatesBySizeGsm[size][gsm] = Number((colorBase * sizeMultiplier * priceMul).toFixed(2));
            sheetWeightBySizeGsm[size][gsm] = Number((baseWeight * weightMul).toFixed(2));
        }
    }

    return {
        ...raw,
        gsmOptions: gsms,
        bwRatesBySizeGsm,
        colorRatesBySizeGsm,
        sheetWeightBySizeGsm,
        defaultGsm: raw.defaultGsm || gsms[0] || DEFAULT_PRICING_SETTINGS.defaultGsm,
    };
}

function sanitizeSettings(raw: Partial<PrintPricingSettings> | undefined): PrintPricingSettings {
    const migrated = migrateLegacyIfNeeded(raw);
    const merged = {
        ...DEFAULT_PRICING_SETTINGS,
        ...migrated,
        paperMultipliers: {
            ...DEFAULT_PRICING_SETTINGS.paperMultipliers,
            ...(migrated.paperMultipliers || {}),
        },
        bindingCharges: {
            ...DEFAULT_PRICING_SETTINGS.bindingCharges,
            ...(migrated.bindingCharges || {}),
        },
        bindingWeightGrams: {
            ...DEFAULT_PRICING_SETTINGS.bindingWeightGrams,
            ...(migrated.bindingWeightGrams || {}),
        },
    };

    const sizes = unique([
        ...Object.keys(merged.bwRatesBySizeGsm || {}),
        ...Object.keys(merged.colorRatesBySizeGsm || {}),
        ...Object.keys(merged.sheetWeightBySizeGsm || {}),
        ...Object.keys(DEFAULT_PRICING_SETTINGS.bwRatesBySizeGsm),
    ]);

    const gsms = unique([
        ...DEFAULT_PRICING_SETTINGS.gsmOptions,
        ...(merged.gsmOptions || []).map((gsm) => String(gsm)),
        ...matrixKeys(merged.bwRatesBySizeGsm),
        ...matrixKeys(merged.colorRatesBySizeGsm),
        ...matrixKeys(merged.sheetWeightBySizeGsm),
    ]);

    const result: PrintPricingSettings = {
        ...merged,
        gsmOptions: gsms,
        bwRatesBySizeGsm: buildMatrix(merged.bwRatesBySizeGsm, DEFAULT_PRICING_SETTINGS.bwRatesBySizeGsm, sizes, gsms),
        colorRatesBySizeGsm: buildMatrix(merged.colorRatesBySizeGsm, DEFAULT_PRICING_SETTINGS.colorRatesBySizeGsm, sizes, gsms),
        sheetWeightBySizeGsm: buildMatrix(merged.sheetWeightBySizeGsm, DEFAULT_PRICING_SETTINGS.sheetWeightBySizeGsm, sizes, gsms),
    };

    if (!sizes.includes(result.defaultPageSize)) {
        result.defaultPageSize = sizes[0] || DEFAULT_PRICING_SETTINGS.defaultPageSize;
    }
    if (!gsms.includes(result.defaultGsm)) {
        result.defaultGsm = gsms[0] || DEFAULT_PRICING_SETTINGS.defaultGsm;
    }
    if (!Object.keys(result.paperMultipliers).includes(result.defaultPaperType)) {
        result.defaultPaperType = Object.keys(result.paperMultipliers)[0] || DEFAULT_PRICING_SETTINGS.defaultPaperType;
    }
    if (!Object.keys(result.bindingCharges).includes(result.defaultBindingType)) {
        result.defaultBindingType = Object.keys(result.bindingCharges)[0] || DEFAULT_PRICING_SETTINGS.defaultBindingType;
    }

    return result;
}

export interface SaveSettingsResult {
    storage: 'backend' | 'local';
    warning?: string;
}

export const SettingsService = {
    async getPricingSettings(): Promise<PrintPricingSettings> {
        const local = readLocalSettings();
        try {
            const response = await fetchApi('/settings/pricing');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const remote = sanitizeSettings(await response.json());
            writeLocalSettings(remote);
            return remote;
        } catch (_error) {
            if (local) return local;
            return DEFAULT_PRICING_SETTINGS;
        }
    },

    async savePricingSettings(settings: PrintPricingSettings): Promise<SaveSettingsResult> {
        const sanitized = sanitizeSettings(settings);
        writeLocalSettings(sanitized);

        try {
            const response = await fetchApi('/settings/pricing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitized),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(body.error || `HTTP ${response.status}`);
            }
            return { storage: 'backend' };
        } catch (error: any) {
            return {
                storage: 'local',
                warning: `Saved locally. Backend sync failed (${error?.message || 'unknown'}).`,
            };
        }
    },
};

