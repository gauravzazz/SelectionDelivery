/**
 * Bluedart Mock Adapter
 * Simulates a premium, fast courier.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote } from '../types';

export class BluedartAdapter implements CourierAdapter {
    id = 'bluedart';
    name = 'Bluedart';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        // Mock pricing: base ₹70 + ₹0.12/gram — premium but fast
        const price = Math.round(70 + payload.weightGrams * 0.12);
        const deliveryDays = payload.originPincode === payload.destinationPincode ? 1 : 2;

        return {
            courierId: this.id,
            courierName: this.name,
            price,
            deliveryDays,
            available: true,
        };
    }
}
