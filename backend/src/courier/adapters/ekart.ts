/**
 * Ekart Real Courier Integration Adapter
 * (Elite Ekart Logistics API)
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

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
                source: this.name,
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
                        source: this.name,
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
                    source: this.name,
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
                    source: this.name,
                    price: Math.round(parseFloat(rawData.total)),
                    deliveryDays: this.serviceType === 'EXPRESS' ? 2 : 4,
                    available: true,
                };
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
            console.error('[EkartAdapter] Error fetching quote:', error);
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
        const token = await this.getToken();
        if (!token) throw new Error('Failed to authenticate with Ekart');

        const ekartPayload = {
            client_id: process.env.EKART_CLIENT_ID,
            shipments: [{
                client_reference_id: payload.orderId,
                service_type: this.serviceType,
                shipment_type: "FORWARD",
                cod_amount: payload.paymentMethod === 'cod' ? payload.amount : 0,
                collectable_amount: payload.paymentMethod === 'cod' ? payload.amount : 0,
                declared_value: payload.amount,
                consignee_details: {
                    name: payload.deliveryAddress.name,
                    address_line1: payload.deliveryAddress.address.substring(0, 100),
                    pincode: payload.deliveryAddress.pincode,
                    contact_number: payload.deliveryAddress.phone,
                    primary_contact_number: payload.deliveryAddress.phone
                },
                vendor_details: {
                    vendor_name: payload.pickupAddress.name,
                    pincode: payload.pickupAddress.pincode,
                    contact_number: payload.pickupAddress.phone,
                    vendor_code: process.env.EKART_VENDOR_CODE || "DEFAULT"
                },
                package_details: {
                    dim_unit: "cm",
                    weight_unit: "g",
                    length: 10,
                    width: 10,
                    height: 10,
                    weight: payload.weightGrams
                },
                item_details: payload.items.map(item => ({
                    item_description: item.title,
                    item_quantity: item.quantity,
                    item_value: item.price
                }))
            }]
        };

        try {
            const response = await fetch('https://app.elite.ekartlogistics.in/integrations/v2/shipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(ekartPayload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[EkartAdapter] Create shipment failed:', JSON.stringify(errorData));
                throw new Error(`Ekart API error: ${response.status}`);
            }

            const data: any = await response.json();
            // Ekart usually returns a list of shipment responses
            const shipmentResult = data.shipment_responses?.[0];

            if (shipmentResult && shipmentResult.status === 'SUCCESS') {
                return {
                    trackingId: shipmentResult.tracking_id,
                    courierName: this.name,
                    estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
                };
            } else {
                const errMsg = shipmentResult?.error_message || 'Unknown Ekart error';
                throw new Error(`Ekart failed: ${errMsg}`);
            }
        } catch (error: any) {
            console.error('[EkartAdapter] Shipment creation error:', error);
            throw error;
        }
    }

    async cancelShipment(trackingId: string, orderId?: string): Promise<{ success: boolean; message?: string }> {
        const token = await this.getToken();
        if (!token) throw new Error('Failed to authenticate with Ekart');

        try {
            const response = await fetch(`https://app.elite.ekartlogistics.in/integrations/v2/shipments/${trackingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                return { success: false, message: (errorData as any).message || `HTTP ${response.status}` };
            }
        } catch (error: any) {
            console.error('[EkartAdapter] Cancellation error:', error);
            return { success: false, message: error.message };
        }
    }

    async getLabel(trackingId: string, orderId?: string): Promise<{ labelUrl: string }> {
        // Return the standardized label fetching URL from their documentation
        // Often it's a direct endpoint or we serve it via backend proxy
        return {
            labelUrl: `https://app.elite.ekartlogistics.in/integrations/v2/shipments/${trackingId}/label`
        };
    }
}
