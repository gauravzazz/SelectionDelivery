/**
 * Print Specification Configuration
 * All values are config-driven — change here, no code changes needed.
 */

/** Base weight per sheet in grams at 80 GSM reference */
export const PAGE_SIZE_BASE_WEIGHT: Record<string, number> = {
    A4: 5,
    A3: 8,
    A5: 3,
    Letter: 5,
};

/** GSM multiplier relative to 80 GSM baseline */
export const GSM_MULTIPLIER: Record<string, number> = {
    '70': 0.9,
    '80': 1.0,
    '100': 1.25,
    '130': 1.6,
};

/** Additional weight for binding in grams */
export const BINDING_WEIGHT: Record<string, number> = {
    none: 0,
    spiral: 120,
    perfect: 180,
    hardbound: 350,
};

/** Additional weight for packaging in grams */
export const PACKAGING_WEIGHT: Record<string, number> = {
    standard: 150,
    reinforced: 300,
};

/* ── Derived option lists (for frontend dropdown population) ── */
export const PAGE_SIZES = Object.keys(PAGE_SIZE_BASE_WEIGHT);
export const GSM_OPTIONS = Object.keys(GSM_MULTIPLIER);
export const BINDING_TYPES = Object.keys(BINDING_WEIGHT);
export const PACKAGING_TYPES = Object.keys(PACKAGING_WEIGHT);
export const PRINT_SIDES = ['single', 'double'] as const;
