/**
 * Weight Calculation Engine — Frontend Edition
 *
 * Pure, deterministic function.
 * Runs entirely on the client for instant weight preview.
 * Config values are loaded from the backend's GET /options endpoint.
 */

export interface WeightConfig {
    pageSizeBaseWeight: Record<string, number>;
    gsmMultiplier: Record<string, number>;
    bindingWeight: Record<string, number>;
    packagingWeight: Record<string, number>;
}

export interface WeightInput {
    pageCount: number;
    printSide: 'single' | 'double';
    pageSize: string;
    gsm: string;
    bindingType: string;
    packagingType: string;
}

export interface WeightResult {
    physicalSheets: number;
    paperWeightGrams: number;
    bindingWeightGrams: number;
    packagingWeightGrams: number;
    totalWeightGrams: number;
}

export function getPhysicalSheets(
    pageCount: number,
    printSide: 'single' | 'double',
): number {
    if (pageCount <= 0) return 0;
    return printSide === 'double' ? Math.ceil(pageCount / 2) : pageCount;
}

export function calculateWeight(
    input: WeightInput,
    config: WeightConfig,
): WeightResult {
    const { pageCount, printSide, pageSize, gsm, bindingType, packagingType } = input;

    const baseWeight = config.pageSizeBaseWeight[pageSize] ?? 0;
    const gsmMul = config.gsmMultiplier[gsm] ?? 1;
    const bindingWt = config.bindingWeight[bindingType] ?? 0;
    const packagingWt = config.packagingWeight[packagingType] ?? 0;

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
