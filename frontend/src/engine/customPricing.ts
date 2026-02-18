import { PrintPricingSettings } from '../api/settingsApi';
import { getPhysicalSheets } from './weightCalculator';

export interface CustomPrintInput {
    pageCount: number;
    printMode: 'color' | 'bw';
    pageSize: string;
    paperType: string;
    bindingType: string;
}

export interface CustomPricingResult {
    unitPrice: number;
    unitWeightGrams: number;
}

function roundRupee(value: number): number {
    return Math.max(0, Math.round(value));
}

export function calculateCustomPricing(
    input: CustomPrintInput,
    settings: PrintPricingSettings,
): CustomPricingResult {
    const pageRate =
        input.printMode === 'color'
            ? settings.colorPageRate
            : settings.bwPageRate;

    const sizeMultiplier = settings.sizeMultipliers[input.pageSize] ?? 1;
    const paperMultiplier = settings.paperMultipliers[input.paperType] ?? 1;
    const bindingCharge = settings.bindingCharges[input.bindingType] ?? 0;

    const pagesPrice = input.pageCount * pageRate * sizeMultiplier * paperMultiplier;
    const unitPrice = roundRupee(
        Math.max(settings.minOrderCharge, pagesPrice + bindingCharge + settings.packagingCharge),
    );

    const sheets = getPhysicalSheets(input.pageCount, 'double');
    const baseSheetWeight = settings.baseWeightBySize[input.pageSize] ?? 5;
    const paperWeight = sheets * baseSheetWeight * paperMultiplier;
    const bindingWeight = settings.bindingWeightGrams[input.bindingType] ?? 0;
    const unitWeightGrams = roundRupee(paperWeight + bindingWeight + settings.packagingWeightGrams);

    return { unitPrice, unitWeightGrams };
}

