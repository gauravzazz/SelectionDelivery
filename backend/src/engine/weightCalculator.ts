/**
 * Weight Calculation Engine
 *
 * Pure, deterministic, courier-agnostic, store-agnostic.
 * Converts print specifications → shipment weight in grams.
 */

import {
    PAGE_SIZE_BASE_WEIGHT,
    GSM_MULTIPLIER,
    BINDING_WEIGHT,
    PACKAGING_WEIGHT,
} from '../config/printSpecs';

export interface WeightInput {
    pageCount: number;         // logical pages entered by user
    printSide: 'single' | 'double';
    pageSize: string;          // e.g. "A4"
    gsm: string;               // e.g. "80"
    bindingType: string;       // e.g. "spiral"
    packagingType: string;     // e.g. "standard"
}

export interface WeightResult {
    physicalSheets: number;
    paperWeightGrams: number;
    bindingWeightGrams: number;
    packagingWeightGrams: number;
    totalWeightGrams: number;
}

/**
 * Convert logical pages to physical sheets based on print side.
 */
export function getPhysicalSheets(
    pageCount: number,
    printSide: 'single' | 'double',
): number {
    if (pageCount <= 0) return 0;
    return printSide === 'double' ? Math.ceil(pageCount / 2) : pageCount;
}

/**
 * Calculate total shipment weight from print specs.
 *
 * Formula:
 *   paperWeight  = physicalSheets × basePageWeight × gsmMultiplier
 *   totalWeight  = paperWeight + bindingWeight + packagingWeight
 */
export function calculateWeight(input: WeightInput): WeightResult {
    const { pageCount, printSide, pageSize, gsm, bindingType, packagingType } = input;

    const baseWeight = PAGE_SIZE_BASE_WEIGHT[pageSize];
    if (baseWeight === undefined) {
        throw new Error(`Unknown page size: ${pageSize}`);
    }

    const gsmMul = GSM_MULTIPLIER[gsm];
    if (gsmMul === undefined) {
        throw new Error(`Unknown GSM value: ${gsm}`);
    }

    const bindingWt = BINDING_WEIGHT[bindingType];
    if (bindingWt === undefined) {
        throw new Error(`Unknown binding type: ${bindingType}`);
    }

    const packagingWt = PACKAGING_WEIGHT[packagingType];
    if (packagingWt === undefined) {
        throw new Error(`Unknown packaging type: ${packagingType}`);
    }

    const physicalSheets = getPhysicalSheets(pageCount, printSide);
    const paperWeightGrams = physicalSheets * baseWeight * gsmMul;
    const totalWeightGrams = paperWeightGrams + bindingWt + packagingWt;

    return {
        physicalSheets,
        paperWeightGrams,
        bindingWeightGrams: bindingWt,
        packagingWeightGrams: packagingWt,
        totalWeightGrams,
    };
}
