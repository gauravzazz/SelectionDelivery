/**
 * Courier types — adapter interface and shared payloads.
 */

export interface CourierPayload {
    originPincode: string;
    destinationPincode: string;
    weightGrams: number;
}

export interface CourierQuote {
    courierId: string;
    courierName: string;
    price: number;         // INR
    deliveryDays: number;
    available: boolean;
}

/**
 * Every courier adapter must implement this interface.
 */
export interface CourierAdapter {
    id: string;
    name: string;
    isEnabled(): boolean;
    getQuote(payload: CourierPayload): Promise<CourierQuote>;
    createShipment(payload: ShipmentPayload): Promise<ShipmentResponse>;
    cancelShipment(trackingId: string, orderId?: string): Promise<{ success: boolean; message?: string }>;
    getLabel(trackingId: string, orderId?: string): Promise<{ labelUrl: string }>;
}

export interface ShipmentPayload {
    orderId: string;
    courierId: string;
    pickupAddress: {
        name: string;
        phone: string;
        pincode: string;
        address: string;
    };
    deliveryAddress: {
        name: string;
        phone: string;
        pincode: string;
        address: string;
    };
    items: {
        title: string;
        quantity: number;
        price: number;
    }[];
    weightGrams: number;
    paymentMethod: 'prepaid' | 'cod';
    amount: number;
}

export interface ShipmentResponse {
    trackingId: string;
    courierName: string;
    labelUrl?: string; // URL to download shipping label
    estimatedDelivery?: string;
}
