/**
 * DTDC Mock Adapter
 * Simulates a budget courier with longer delivery times.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote } from '../types';

export class DtdcAdapter implements CourierAdapter {
    id = 'dtdc';
    name = 'DTDC';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        // Mock pricing: base ₹30 + ₹0.06/gram — cheapest, slowest
        const price = Math.round(30 + payload.weightGrams * 0.06);
        const deliveryDays = payload.originPincode === payload.destinationPincode ? 2 : 4;

        return {
            courierId: this.id,
            courierName: this.name,
            price,
            deliveryDays,
            available: true,
        };
    }
}
