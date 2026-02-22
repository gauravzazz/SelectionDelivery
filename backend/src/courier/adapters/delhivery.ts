/**
 * Delhivery Mock Adapter
 * Simulates a cost-effective courier with moderate delivery speed.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

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
            source: this.name,
            price,
            deliveryDays,
            available: true,
        };
    }

    async createShipment(payload: ShipmentPayload): Promise<ShipmentResponse> {
        // Mock shipment creation
        const mockTrackingId = `DELHIVERY${Math.floor(100000 + Math.random() * 900000)}`;
        return {
            trackingId: mockTrackingId,
            courierName: this.name,
            labelUrl: `https://www.delhivery.com/label/${mockTrackingId}.pdf`,
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }

    async cancelShipment(trackingId: string): Promise<{ success: boolean; message?: string }> {
        return { success: false, message: 'Delhivery cancellation not implemented' };
    }

    async getLabel(trackingId: string): Promise<{ labelUrl: string }> {
        return { labelUrl: `https://www.delhivery.com/label/${trackingId}.pdf` };
    }
}
