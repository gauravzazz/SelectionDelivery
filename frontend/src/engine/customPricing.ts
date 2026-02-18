import { PrintPricingSettings } from '../api/settingsApi';
import { getPhysicalSheets } from './weightCalculator';

export interface CustomPrintInput {
    pageCount: number;
    printMode: 'color' | 'bw';
    pageSize: string;
    gsm: string;
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
    const priceMatrix =
        input.printMode === 'color'
            ? settings.colorRatesBySizeGsm
            : settings.bwRatesBySizeGsm;
    const pageRate =
        priceMatrix[input.pageSize]?.[input.gsm] ?? 0;

    const paperMultiplier = settings.paperMultipliers[input.paperType] ?? 1;
    const bindingCharge = settings.bindingCharges[input.bindingType] ?? 0;

    const pagesPrice = input.pageCount * pageRate * paperMultiplier;
    const unitPrice = roundRupee(
        Math.max(settings.minOrderCharge, pagesPrice + bindingCharge + settings.packagingCharge),
    );

    const sheets = getPhysicalSheets(input.pageCount, 'double');
    const sheetWeight = settings.sheetWeightBySizeGsm[input.pageSize]?.[input.gsm] ?? 0;
    const paperWeight = sheets * sheetWeight * paperMultiplier;
    const bindingWeight = settings.bindingWeightGrams[input.bindingType] ?? 0;
    const unitWeightGrams = roundRupee(paperWeight + bindingWeight + settings.packagingWeightGrams);

    return { unitPrice, unitWeightGrams };
}
