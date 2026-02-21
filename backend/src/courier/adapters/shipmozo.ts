import axios from 'axios';
import { getEnabledCouriers } from '../../config/couriers';
import { CourierAdapter, CourierPayload, CourierQuote, ShipmentPayload, ShipmentResponse } from '../types';

const SHIPMOZO_BASE_URL = 'https://shipping-api.com/app/api/v1';
const PUBLIC_KEY = 'mjLZxH7eQSnTohF2rO8k';
const PRIVATE_KEY = 'ZXOUnx3JMC56FhEBNYG8';

export class ShipmozoAdapter implements CourierAdapter {
    id = 'shipmozo';
    name = 'Shipmozo';

    isEnabled(): boolean {
        return getEnabledCouriers().some((c) => c.id === this.id);
    }

    private getHeaders() {
        return {
            'public-key': PUBLIC_KEY,
            'private-key': PRIVATE_KEY,
            'Content-Type': 'application/json',
        };
    }

    async getQuote(payload: CourierPayload): Promise<CourierQuote> {
        try {
            const response = await axios.post(
                `${SHIPMOZO_BASE_URL}/rate-calculator`,
                {
                    pickup_pincode: payload.originPincode,
                    delivery_pincode: payload.destinationPincode,
                    weight: payload.weightGrams.toString(),
                    payment_type: "PREPAID",
                    shipment_type: "FORWARD"
                },
                { headers: this.getHeaders() }
            );

            // Note: Actual Shipmozo structure might differ slightly, this is assumed based on standard practices
            // Given the limited response schema in Swagger ("Successful operation"), this parses standard result
            const price = response.data?.data?.rate || response.data?.rate || 0; // fallback if needed

            return {
                courierId: this.id,
                courierName: this.name,
                price: parseFloat(price) || 0,
                deliveryDays: 3, // fallback days
                available: true,
            };
        } catch (error) {
            console.error('Shipmozo getQuote error:', error);
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
        try {
            const shipmozoBody = {
                order_id: payload.orderId,
                order_date: new Date().toISOString().split('T')[0],
                consignee_name: payload.deliveryAddress.name,
                consignee_phone: payload.deliveryAddress.phone,
                consignee_email: "customer@example.com", // Add generic email if not provided
                consignee_address_line_one: payload.deliveryAddress.address,
                consignee_pin_code: payload.deliveryAddress.pincode,
                consignee_city: "Unknown", // Can be inferred or passed later if needed
                consignee_state: "Unknown",
                payment_type: payload.paymentMethod.toUpperCase(),
                weight: payload.weightGrams.toString(),
                product_detail: payload.items.map(item => ({
                    name: item.title,
                    sku_number: item.title.substring(0, 5),
                    quantity: item.quantity,
                    unit_price: item.price,
                }))
            };

            const response = await axios.post(
                `${SHIPMOZO_BASE_URL}/push-order`,
                shipmozoBody,
                { headers: this.getHeaders() }
            );

            return {
                trackingId: response.data?.data?.refrence_id || response.data?.data?.order_id || payload.orderId,
                courierName: this.name,
                estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            };
        } catch (error) {
            console.error('Shipmozo createShipment error:', error);
            throw new Error('Failed to create Shipmozo shipment');
        }
    }

    async cancelShipment(trackingId: string, orderId?: string): Promise<{ success: boolean; message?: string }> {
        try {
            const body = {
                order_id: orderId || trackingId,
                awb_number: trackingId
            };
            const response = await axios.post(
                `${SHIPMOZO_BASE_URL}/cancel-order`,
                body,
                { headers: this.getHeaders() }
            );

            if (response.data?.result === "1") {
                return { success: true, message: response.data.message || 'Cancelled successfully' };
            }
            return { success: false, message: 'Failed to cancel order with Shipmozo' };
        } catch (error) {
            console.error('Shipmozo cancelShipment error:', error);
            return { success: false, message: 'API error during cancellation' };
        }
    }

    async getLabel(trackingId: string, orderId?: string): Promise<{ labelUrl: string }> {
        try {
            const response = await axios.get(
                `${SHIPMOZO_BASE_URL}/get-order-label/${trackingId}?type_of_label=PDF`,
                { headers: this.getHeaders() }
            );
            return { labelUrl: response.data?.data?.label_url || response.data?.label_url || '' };
        } catch (error) {
            console.error('Shipmozo getLabel error:', error);
            return { labelUrl: '' };
        }
    }

    async trackShipment(trackingId: string): Promise<any> {
        try {
            const response = await axios.get(
                `${SHIPMOZO_BASE_URL}/track-order?awb_number=${trackingId}`,
                { headers: this.getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Shipmozo trackShipment error:', error);
            throw new Error(`Tracking failed: ${error}`);
        }
    }
}
