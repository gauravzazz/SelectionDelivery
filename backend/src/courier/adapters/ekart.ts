/**
 * Ekart Real Courier Integration Adapter
 * (Elite Ekart Logistics API)
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote } from '../types';

export class EkartAdapter implements CourierAdapter {
    id: string;
    name: string;
    private serviceType: 'SURFACE' | 'EXPRESS';

    // Simple static cache for the token to avoid re-auth on every request
    private static cachedToken: string | null = null;
    private static tokenExpiry: number = 0;

    constructor(serviceType: 'SURFACE' | 'EXPRESS' = 'SURFACE') {
        this.serviceType = serviceType;
        this.id = `ekart_${serviceType.toLowerCase()}`;
        this.name = `Ekart ${serviceType.charAt(0) + serviceType.slice(1).toLowerCase()}`;
    }

    private async getToken(): Promise<string | null> {
        // Check if cached token is still valid (using 23h buffer for safety)
        if (EkartAdapter.cachedToken && Date.now() < EkartAdapter.tokenExpiry) {
            return EkartAdapter.cachedToken;
        }

        const clientId = process.env.EKART_CLIENT_ID;
        const username = process.env.EKART_USERNAME;
        const password = process.env.EKART_PASSWORD;

        if (!clientId || !username || !password) {
            console.error('[EkartAdapter] Missing credentials in .env');
            return null;
        }

        try {
            const response = await fetch(`https://app.elite.ekartlogistics.in/integrations/v2/auth/token/${clientId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                console.error('[EkartAdapter] Auth failed:', response.status);
                return null;
            }

            const data: any = await response.json();
            if (data.access_token) {
                EkartAdapter.cachedToken = data.access_token;
                // Token is valid for 24h, expire it in 23h locally
                EkartAdapter.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
                return data.access_token;
            } else {
                console.error('[EkartAdapter] No token in response:', JSON.stringify(data));
            }
        } catch (error) {
            console.error('[EkartAdapter] Token error:', error);
        }
        return null;
    }

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id || c.id === 'ekart');
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        const token = await this.getToken();

        if (!token) {
            return {
                courierId: this.id,
                courierName: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };
        }

        const requestBody = {
            pickupPincode: parseInt(payload.originPincode),
            dropPincode: parseInt(payload.destinationPincode),
            invoiceAmount: 100,
            weight: payload.weightGrams,
            length: 10,
            height: 10,
            width: 10,
            serviceType: this.serviceType,
            shippingDirection: "FORWARD",
            codAmount: 0,
            packages: [
                {
                    length: 10,
                    width: 10,
                    height: 10,
                    weight: payload.weightGrams
                }
            ]
        };

        try {
            const response = await fetch('https://app.elite.ekartlogistics.in/data/pricing/estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                if (response.status === 400 || response.status === 404) {
                    return {
                        courierId: this.id,
                        courierName: this.name,
                        price: 0,
                        deliveryDays: 0,
                        available: false,
                    };
                }
                const errorData = await response.json().catch(() => ({}));
                console.error(`[EkartAdapter] Quote error (${response.status}):`, JSON.stringify(errorData));
                return {
                    courierId: this.id,
                    courierName: this.name,
                    price: 0,
                    deliveryDays: 0,
                    available: false,
                };
            }

            const rawData: any = await response.json();

            if (rawData && rawData.total) {
                return {
                    courierId: this.id,
                    courierName: this.name,
                    price: Math.round(parseFloat(rawData.total)),
                    deliveryDays: this.serviceType === 'EXPRESS' ? 2 : 4,
                    available: true,
                };
            }

            return {
                courierId: this.id,
                courierName: this.name,
                price: 0,
                deliveryDays: 0,
                available: false,
            };

        } catch (error) {
            console.error('[EkartAdapter] Error fetching quote:', error);
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
