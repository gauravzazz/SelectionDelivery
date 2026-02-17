/**
 * Shipping Quote API Client
 * Frontend sends pre-calculated weight + optional courier filter.
 */

export interface QuoteRequest {
    destinationPincode: string;
    weightGrams: number;
    courierIds?: string[];
}

export interface ShippingOption {
    courierId: string;
    courierName: string;
    price: number;
    deliveryDays: number;
    available: boolean;
    storePincode: string;
    storeName: string;
}

export interface QuoteResponse {
    cheapest: ShippingOption | null;
    fastest: ShippingOption | null;
    allOptions: ShippingOption[];
    weightGrams: number;
}

export interface CourierInfo {
    id: string;
    name: string;
    enabled: boolean;
}

export interface DropdownOptions {
    pageSizes: string[];
    gsmOptions: string[];
    bindingTypes: string[];
    packagingTypes: string[];
    printSides: string[];
    pageSizeBaseWeight: Record<string, number>;
    gsmMultiplier: Record<string, number>;
    bindingWeight: Record<string, number>;
    packagingWeight: Record<string, number>;
    couriers: CourierInfo[];
}

const API_BASE = 'http://127.0.0.1:4000/api/shipping-quote';

export async function fetchShippingQuote(
    req: QuoteRequest,
): Promise<QuoteResponse> {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function fetchDropdownOptions(): Promise<DropdownOptions> {
    const res = await fetch(`${API_BASE}/options`);
    if (!res.ok) throw new Error('Failed to load options');
    return res.json();
}
