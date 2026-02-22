/**
 * DTDC Mock Adapter
 * Simulates a budget courier with longer delivery times.
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

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
            source: this.name,
            price,
            deliveryDays,
            available: true,
        };
    }
    async createShipment(payload: ShipmentPayload): Promise<ShipmentResponse> {
        // Mock shipment creation
        const mockTrackingId = `DTDC${Math.floor(100000 + Math.random() * 900000)}`;
        return {
            trackingId: mockTrackingId,
            courierName: this.name,
            labelUrl: `https://www.dtdc.in/label/${mockTrackingId}.pdf`,
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }

    async cancelShipment(trackingId: string): Promise<{ success: boolean; message?: string }> {
        return { success: false, message: 'DTDC cancellation not implemented' };
    }

    async getLabel(trackingId: string): Promise<{ labelUrl: string }> {
        return { labelUrl: `https://www.dtdc.in/label/${trackingId}.pdf` };
    }
}
