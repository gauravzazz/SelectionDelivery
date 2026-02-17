/**
 * Shipping Quote API Route
 * POST /api/shipping-quote
 *
 * Frontend sends pre-calculated weightGrams + optional courier filter.
 * Backend only does courier aggregation — no weight logic here.
 */

import { Router, Request, Response } from 'express';
import { aggregateShippingQuotes } from '../services/aggregationService';
import {
    PAGE_SIZES,
    GSM_OPTIONS,
    BINDING_TYPES,
    PACKAGING_TYPES,
    PRINT_SIDES,
    PAGE_SIZE_BASE_WEIGHT,
    GSM_MULTIPLIER,
    BINDING_WEIGHT,
    PACKAGING_WEIGHT,
} from '../config/printSpecs';
import { COURIER_CONFIG } from '../config/couriers';

const router = Router();

interface QuoteRequestBody {
    destinationPincode: string;
    weightGrams: number;
    courierIds?: string[];  // optional filter — only query these couriers
}

function validateBody(body: QuoteRequestBody): string | null {
    if (!body.destinationPincode || !/^\d{6}$/.test(body.destinationPincode)) {
        return 'destinationPincode must be a 6-digit string';
    }
    if (!body.weightGrams || body.weightGrams <= 0) {
        return 'weightGrams must be a positive number';
    }
    if (body.courierIds && !Array.isArray(body.courierIds)) {
        return 'courierIds must be an array of strings';
    }
    return null;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const body = req.body as QuoteRequestBody;
        const error = validateBody(body);
        if (error) {
            res.status(400).json({ error });
            return;
        }

        // Aggregate quotes across all stores × selected couriers
        const result = await aggregateShippingQuotes(
            body.destinationPincode,
            body.weightGrams,
            body.courierIds,
        );

        res.json(result);
    } catch (err) {
        console.error('[Quote API] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/shipping-quote/options
 * Returns all config values so the frontend can populate dropdowns
 * AND run weight calculations locally.
 */
router.get('/options', (_req: Request, res: Response) => {
    res.json({
        pageSizes: PAGE_SIZES,
        gsmOptions: GSM_OPTIONS,
        bindingTypes: BINDING_TYPES,
        packagingTypes: PACKAGING_TYPES,
        printSides: PRINT_SIDES,
        // Weight config for frontend calculation
        pageSizeBaseWeight: PAGE_SIZE_BASE_WEIGHT,
        gsmMultiplier: GSM_MULTIPLIER,
        bindingWeight: BINDING_WEIGHT,
        packagingWeight: PACKAGING_WEIGHT,
        // Available couriers for the filter
        couriers: COURIER_CONFIG.map((c) => ({
            id: c.id,
            name: c.name,
            enabled: c.enabled,
        })),
    });
});

export default router;
