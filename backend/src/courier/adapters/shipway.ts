/**
 * Shipway Real Courier Integration Adapter
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote } from '../types';

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
            console.error('[ShipwayAdapter] Error fetching quote:', error);
            return {
                courierId: this.id,
                courierName: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };
        }
    }
}
