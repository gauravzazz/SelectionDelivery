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
}
