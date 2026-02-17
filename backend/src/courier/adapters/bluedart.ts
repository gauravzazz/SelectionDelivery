/**
 * Bluedart Mock Adapter
 * Simulates a premium, fast courier.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

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
    async createShipment(payload: ShipmentPayload): Promise<ShipmentResponse> {
        // Mock shipment creation
        const mockTrackingId = `BLUEDART${Math.floor(100000 + Math.random() * 900000)}`;
        return {
            trackingId: mockTrackingId,
            courierName: this.name,
            labelUrl: `https://www.bluedart.com/label/${mockTrackingId}.pdf`,
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }
}
