/**
 * Weight Calculation Engine — Unit Tests
 */

import { calculateWeight, getPhysicalSheets } from '../engine/weightCalculator';

describe('getPhysicalSheets', () => {
    it('returns same count for single-side', () => {
        expect(getPhysicalSheets(10, 'single')).toBe(10);
    });

    it('halves count for double-side (even)', () => {
        expect(getPhysicalSheets(10, 'double')).toBe(5);
    });

    it('rounds up for double-side (odd)', () => {
        expect(getPhysicalSheets(11, 'double')).toBe(6);
    });

    it('returns 0 for 0 pages', () => {
        expect(getPhysicalSheets(0, 'single')).toBe(0);
        expect(getPhysicalSheets(0, 'double')).toBe(0);
    });

    it('handles 1 page double-side', () => {
        expect(getPhysicalSheets(1, 'double')).toBe(1);
    });
});

describe('calculateWeight', () => {
    it('case 1: 10 pages, single-side, A4, 80gsm, no binding, standard pkg', () => {
        const result = calculateWeight({
            pageCount: 10,
            printSide: 'single',
            pageSize: 'A4',
            gsm: '80',
            bindingType: 'none',
            packagingType: 'standard',
        });
        // 10 sheets × 5g × 1.0 + 0 + 150 = 200g
        expect(result.physicalSheets).toBe(10);
        expect(result.paperWeightGrams).toBe(50);
        expect(result.totalWeightGrams).toBe(200);
    });

    it('case 2: 10 pages, double-side, A4, 80gsm, no binding, standard pkg', () => {
        const result = calculateWeight({
            pageCount: 10,
            printSide: 'double',
            pageSize: 'A4',
            gsm: '80',
            bindingType: 'none',
            packagingType: 'standard',
        });
        // 5 sheets × 5g × 1.0 + 0 + 150 = 175g
        expect(result.physicalSheets).toBe(5);
        expect(result.paperWeightGrams).toBe(25);
        expect(result.totalWeightGrams).toBe(175);
    });

    it('case 3: 11 pages, double-side, A4, 80gsm, spiral, standard pkg', () => {
        const result = calculateWeight({
            pageCount: 11,
            printSide: 'double',
            pageSize: 'A4',
            gsm: '80',
            bindingType: 'spiral',
            packagingType: 'standard',
        });
        // 6 sheets × 5g × 1.0 + 120 + 150 = 300g
        expect(result.physicalSheets).toBe(6);
        expect(result.paperWeightGrams).toBe(30);
        expect(result.bindingWeightGrams).toBe(120);
        expect(result.totalWeightGrams).toBe(300);
    });

    it('case 4: 20 pages, single-side, A3, 130gsm, hardbound, reinforced pkg', () => {
        const result = calculateWeight({
            pageCount: 20,
            printSide: 'single',
            pageSize: 'A3',
            gsm: '130',
            bindingType: 'hardbound',
            packagingType: 'reinforced',
        });
        // 20 sheets × 8g × 1.6 + 350 + 300 = 906g
        expect(result.physicalSheets).toBe(20);
        expect(result.paperWeightGrams).toBe(256);
        expect(result.bindingWeightGrams).toBe(350);
        expect(result.packagingWeightGrams).toBe(300);
        expect(result.totalWeightGrams).toBe(906);
    });

    it('throws for unknown page size', () => {
        expect(() =>
            calculateWeight({
                pageCount: 1,
                printSide: 'single',
                pageSize: 'INVALID',
                gsm: '80',
                bindingType: 'none',
                packagingType: 'standard',
            }),
        ).toThrow('Unknown page size');
    });

    it('throws for unknown GSM', () => {
        expect(() =>
            calculateWeight({
                pageCount: 1,
                printSide: 'single',
                pageSize: 'A4',
                gsm: '999',
                bindingType: 'none',
                packagingType: 'standard',
            }),
        ).toThrow('Unknown GSM value');
    });

    it('A5 with 70gsm double-side', () => {
        const result = calculateWeight({
            pageCount: 100,
            printSide: 'double',
            pageSize: 'A5',
            gsm: '70',
            bindingType: 'perfect',
            packagingType: 'standard',
        });
        // 50 sheets × 3g × 0.9 + 180 + 150 = 465g
        expect(result.physicalSheets).toBe(50);
        expect(result.paperWeightGrams).toBeCloseTo(135);
        expect(result.totalWeightGrams).toBeCloseTo(465);
    });
});
