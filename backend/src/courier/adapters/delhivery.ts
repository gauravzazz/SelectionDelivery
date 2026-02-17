/**
 * Delhivery Mock Adapter
 * Simulates a cost-effective courier with moderate delivery speed.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote } from '../types';

export class DelhiveryAdapter implements CourierAdapter {
    id = 'delhivery';
    name = 'Delhivery';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        // Mock pricing: base ₹40 + ₹0.08/gram + zone surcharge
        const zoneSurcharge = payload.originPincode === payload.destinationPincode ? 0 : 25;
        const price = Math.round(40 + payload.weightGrams * 0.08 + zoneSurcharge);
        const deliveryDays = payload.originPincode === payload.destinationPincode ? 1 : 3;

        return {
            courierId: this.id,
            courierName: this.name,
            price,
            deliveryDays,
            available: true,
        };
    }
}
