/**
 * Shipway Real Courier Integration Adapter
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

export class ShipwayAdapter implements CourierAdapter {
    id = 'shipway';
    name = 'Shipway';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        const email = process.env.SHIPWAY_EMAIL || '';
        const licenseKey = process.env.SHIPWAY_LICENSE_KEY || '';

        if (!email || !licenseKey) {
            console.error('[ShipwayAdapter] Missing SHIPWAY_EMAIL or SHIPWAY_LICENSE_KEY in .env');
            return {
                courierId: this.id,
                courierName: this.name,
                source: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };
        }

        // Basic Auth: base64(email:licenseKey)
        const authString = Buffer.from(`${email}:${licenseKey}`).toString('base64');
        const AUTH_HEADER = `Basic ${authString}`;

        // API Params: weight in KG, dimensions in CM
        const params = new URLSearchParams({
            fromPincode: payload.originPincode,
            toPincode: payload.destinationPincode,
            paymentType: 'prepaid',
            weight: (payload.weightGrams / 1000).toString(),
            length: '10',
            breadth: '10',
            height: '10',
            'shipment type': '1'
        });

        try {
            const url = `https://app.shipway.com/api/getshipwaycarrierrates?${params.toString()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': AUTH_HEADER
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[ShipwayAdapter] API Error (${response.status}): ${errText}`);
                return {
                    courierId: this.id,
                    courierName: this.name,
                    source: this.name,
                    price: 0,
                    deliveryDays: 0,
                    available: false,
                };
            }

            const data: any = await response.json();

            if (data.success === 'success' && Array.isArray(data.rate_card) && data.rate_card.length > 0) {
                const options = data.rate_card
                    .map((opt: any) => ({
                        price: parseFloat(opt.delivery_charge || 0),
                        days: 4,
                        name: opt.courier_name || 'Shipway Partner'
                    }))
                    .filter((opt: any) => opt.price > 0)
                    .sort((a: any, b: any) => a.price - b.price);

                if (options.length > 0) {
                    const best = options[0];
                    return {
                        courierId: this.id,
                        courierName: `Shipway (${best.name})`,
                        source: this.name,
                        price: Math.round(best.price),
                        deliveryDays: best.days,
                        available: true,
                    };
                }
            }

            return {
                courierId: this.id,
                courierName: this.name,
                source: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };

        } catch (error) {
            console.error('[ShipwayAdapter] Error fetching quote:', error);
            return {
                courierId: this.id,
                courierName: this.name,
                source: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };
        }
    }
    async createShipment(payload: ShipmentPayload): Promise<ShipmentResponse> {
        const email = process.env.SHIPWAY_EMAIL || '';
        const licenseKey = process.env.SHIPWAY_LICENSE_KEY || '';
        const authString = Buffer.from(`${email}:${licenseKey}`).toString('base64');
        const AUTH_HEADER = `Basic ${authString}`;

        const shipwayPayload = {
            order_id: payload.orderId,
            carrier_id: payload.courierId, // Optional, Shipway can auto-select if not provided
            cust_name: payload.deliveryAddress.name,
            cust_mobile: payload.deliveryAddress.phone,
            cust_pincode: payload.deliveryAddress.pincode,
            cust_address: payload.deliveryAddress.address,
            weight: payload.weightGrams / 1000,
            payment_type: payload.paymentMethod === 'cod' ? 'cod' : 'prepaid',
            collectable_amount: payload.amount,
            label_generate: "1" // Request label generation
        };

        try {
            const response = await fetch('https://app.shipway.com/api/v2/generateLabel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': AUTH_HEADER
                },
                body: JSON.stringify(shipwayPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Shipway API error: ${response.status} - ${errText}`);
            }

            const data: any = await response.json();

            if (data.status === 'success' || data.success === 'success') {
                return {
                    trackingId: data.tracking_no || data.awb_number,
                    courierName: data.carrier_name || this.name,
                    labelUrl: data.label_url,
                    estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
                };
            } else {
                throw new Error(data.message || 'Shipway creation failed');
            }
        } catch (error: any) {
            console.error('[ShipwayAdapter] Shipment creation error:', error);
            throw error;
        }
    }

    async cancelShipment(trackingId: string, orderId?: string): Promise<{ success: boolean; message?: string }> {
        const email = process.env.SHIPWAY_EMAIL || '';
        const licenseKey = process.env.SHIPWAY_LICENSE_KEY || '';
        const authString = Buffer.from(`${email}:${licenseKey}`).toString('base64');
        const AUTH_HEADER = `Basic ${authString}`;

        try {
            const response = await fetch('https://app.shipway.com/api/v2/cancelOrder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': AUTH_HEADER
                },
                body: JSON.stringify({ tracking_no: trackingId, order_id: orderId })
            });

            const data: any = await response.json();
            if (data.status === 'success' || data.success === 'success') {
                return { success: true };
            } else {
                return { success: false, message: data.message || 'Shipway cancellation failed' };
            }
        } catch (error: any) {
            console.error('[ShipwayAdapter] Cancellation error:', error);
            return { success: false, message: error.message };
        }
    }

    async getLabel(trackingId: string, orderId?: string): Promise<{ labelUrl: string }> {
        // Shipway often provides label URL in the creation response.
        // If needed to fetch again, we can use their label API.
        return { labelUrl: `https://app.shipway.com/api/v2/getLabel?tracking_no=${trackingId}` };
    }
}
