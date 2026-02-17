/**
 * Shipyaari Real Courier Integration Adapter
 * (Shipyaari Blaze V2 API)
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

export class ShipyaariAdapter implements CourierAdapter {
    id = 'shipyaari';
    name = 'Shipyaari';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        // Authorization should ideally come from env variables
        const AUTH_TOKEN = process.env.SHIPYAARI_AUTH_TOKEN || '';

        const requestBody = {
            pickupPincode: parseInt(payload.originPincode),
            deliveryPincode: parseInt(payload.destinationPincode),
            invoiceValue: 10, // Default as per user provided curl
            paymentMode: "PREPAID",
            weight: payload.weightGrams / 1000, // Grams to KG
            orderType: "B2C",
            dimension: {
                length: 1,
                width: 1,
                height: 1
            }
        };

        try {
            const response = await fetch('https://api-seller.shipyaari.com/api/v1/order/checkServiceabilityV2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': AUTH_TOKEN
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Shipyaari API responded with status ${response.status}`);
            }

            const rawData: any = await response.json();

            // Shipyaari Blaze V2 typically returns success: true and data: [...] list of couriers
            if (rawData.success && Array.isArray(rawData.data) && rawData.data.length > 0) {
                // Pick the cheapest valid option from the aggregator
                const options = rawData.data
                    .map((opt: any) => ({
                        price: parseFloat(opt.total_amount || opt.expected_price || 0),
                        days: parseInt(opt.estimated_delivery_days || opt.etd || 4),
                        name: opt.courier_name || 'Shipyaari Partner'
                    }))
                    .filter((opt: any) => opt.price > 0)
                    .sort((a: any, b: any) => a.price - b.price);

                if (options.length > 0) {
                    const best = options[0];
                    return {
                        courierId: this.id,
                        courierName: `Shipyaari (${best.name})`,
                        price: Math.round(best.price),
                        deliveryDays: best.days,
                        available: true,
                    };
                }
            }

            return {
                courierId: this.id,
                courierName: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };

        } catch (error) {
            console.error('[ShipyaariAdapter] Error fetching quote:', error);
            // Return unavailable instead of crashing the whole quote request
            return {
                courierId: this.id,
                courierName: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };
        }
    }
    async createShipment(payload: ShipmentPayload): Promise<ShipmentResponse> {
        // Mock shipment creation for Shipyaari
        const mockTrackingId = `SHIPYAARI${Math.floor(100000 + Math.random() * 900000)}`;
        return {
            trackingId: mockTrackingId,
            courierName: this.name,
            labelUrl: `https://shipyaari.com/label/${mockTrackingId}.pdf`,
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }
}
