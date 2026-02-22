/**
 * Shift Courier Integration Adapter
 * Documentation: https://shift.in/api-documentation/
 */

import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

export class ShiftAdapter implements CourierAdapter {
    id = 'shift';
    name = 'Shift';

    private getBaseUrl(): string {
        return process.env.SHIFT_BASE_URL || 'https://carrier.shift.in';
    }

    private getAuthHeader(): string {
        const username = process.env.SHIFT_USERNAME || 'Pdf2Printout@gmail.com';
        const password = process.env.SHIFT_PASSWORD || 'Pdf198189';
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        return `Basic ${auth}`;
    }

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        const requestBody = {
            originPin: parseInt(payload.originPincode),
            destinationPin: parseInt(payload.destinationPincode),
            weightInGrams: payload.weightGrams,
            declaredValue: 100, // Default for estimation
            codOrder: false,
            packageLength: 10,
            packageBreadth: 10,
            packageHeight: 10
        };

        try {
            const response = await fetch(`${this.getBaseUrl()}/api/v1/open/cost-estimates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`[ShiftAdapter] Rate estimate failed (${response.status}):`, JSON.stringify(errorData));
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

            // Based on docs, it returns a list of carriers with charges
            if (Array.isArray(rawData.data) && rawData.data.length > 0) {
                // Pick the cheapest one
                const options = rawData.data
                    .map((opt: any) => ({
                        price: parseFloat(opt.totalCharges || 0),
                        days: opt.estimatedDeliveryDate ?
                            Math.ceil((new Date(opt.estimatedDeliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 4,
                        name: opt.carrierName || 'Shift Partner'
                    }))
                    .filter((opt: any) => opt.price > 0)
                    .sort((a: any, b: any) => a.price - b.price);

                if (options.length > 0) {
                    const best = options[0];
                    return {
                        courierId: this.id,
                        courierName: `Shift (${best.name})`,
                        source: this.name,
                        price: Math.round(best.price),
                        deliveryDays: best.days > 0 ? best.days : 4,
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
            console.error('[ShiftAdapter] Error fetching quote:', error);
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
        const shiftPayload = {
            pickup_location: {
                address: payload.pickupAddress.address,
                pincode: payload.pickupAddress.pincode,
                phone: payload.pickupAddress.phone,
                name: payload.pickupAddress.name
            },
            delivery_location: {
                address: payload.deliveryAddress.address,
                pincode: payload.deliveryAddress.pincode,
                phone: payload.deliveryAddress.phone,
                name: payload.deliveryAddress.name
            },
            shipment: {
                payment_mode: payload.paymentMethod === 'cod' ? 'COD' : 'PPD',
                total_weight: payload.weightGrams,
                total_declared_value: payload.amount,
                items: payload.items.map(item => ({
                    name: item.title,
                    quantity: item.quantity,
                    selling_price: item.price
                })),
                dimensions: {
                    length: 10,
                    breadth: 10,
                    height: 10
                }
            },
            order_number: payload.orderId
        };

        try {
            const response = await fetch(`${this.getBaseUrl()}/api/v1/open/forward`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                body: JSON.stringify(shiftPayload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[ShiftAdapter] Create shipment failed:', JSON.stringify(errorData));
                throw new Error(`Shift API error: ${response.status}`);
            }

            const data: any = await response.json();
            if (data.success && data.data) {
                return {
                    trackingId: data.data.trackingNumber,
                    courierName: this.name,
                    labelUrl: data.data.shippingLabelUrl,
                    estimatedDelivery: data.data.estimatedDeliveryDate
                };
            } else {
                throw new Error(`Shift failed: ${data.responseMessage || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('[ShiftAdapter] Shipment creation error:', error);
            throw error;
        }
    }

    async cancelShipment(trackingId: string, orderId?: string): Promise<{ success: boolean; message?: string }> {
        const cancelPayload = {
            tracking_number: trackingId,
            cancel_reason: 'Order cancelled by user'
        };

        try {
            const response = await fetch(`${this.getBaseUrl()}/api/v1/open/forward/shipment/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                body: JSON.stringify(cancelPayload)
            });

            const data: any = await response.json();
            if (data.success) {
                return { success: true };
            } else {
                return { success: false, message: data.responseMessage };
            }
        } catch (error: any) {
            console.error('[ShiftAdapter] Cancellation error:', error);
            return { success: false, message: error.message };
        }
    }

    async getLabel(trackingId: string, orderId?: string): Promise<{ labelUrl: string }> {
        // Shift usually provides label in the booking response. 
        // If we need to fetch it again, we might need a specific endpoint or re-call booking (not ideal).
        // For now, assuming trackingId can be used or labelUrl was stored.
        // If there's no direct 'Get Label' endpoint documented in research, 
        // we might return empty or a placeholder if not available.
        return { labelUrl: '' };
    }

    async trackShipment(trackingId: string): Promise<any> {
        try {
            // Docs used orderNumber for tracking, but usually trackingId/trackingNumber is also supported.
            const response = await fetch(`${this.getBaseUrl()}/api/v1/open/track?orderNumber=${trackingId}`, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader()
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data: any = await response.json();
            return data.data;
        } catch (error) {
            console.error('[ShiftAdapter] Tracking error:', error);
            return null;
        }
    }
}
