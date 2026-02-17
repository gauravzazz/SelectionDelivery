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

// Helper to strip trailing slash and specific legacy suffix
// CRITICAL: DO NOT EDIT THIS URL LOGIC WITHOUT EXPLICIT USER REQUEST.
// This handles legacy base URLs that include '/shipping-quote' and prevents double-paths.
const cleanBaseUrl = (url?: string) => {
    if (!url) return '/api';
    // Remove trailing slash
    let cleaned = url.replace(/\/$/, '');
    // Remove legacy suffix if present (case insensitive)
    if (cleaned.toLowerCase().endsWith('/shipping-quote')) {
        cleaned = cleaned.substring(0, cleaned.length - '/shipping-quote'.length);
    }
    // Remove trailing slash again if any
    return cleaned.replace(/\/$/, '') || '/api';
};

const API_ROOT = cleanBaseUrl(import.meta.env.VITE_API_BASE_URL);

export async function fetchShippingQuote(
    req: QuoteRequest,
): Promise<QuoteResponse> {
    const res = await fetch(`${API_ROOT}/shipping-quote`, {
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
    // Add timestamp to bust cache (fix for sticky Firebase Hosting rewrites)
    const res = await fetch(`${API_ROOT}/shipping-quote/options?_t=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to load options');
    return res.json();
}
export interface ShipmentResponse {
    success: boolean;
    shipment: {
        trackingId: string;
        courierName: string;
        labelUrl?: string;
        estimatedDelivery?: string;
    };
}

export const createShipment = async (orderId: string, courierId: string): Promise<ShipmentResponse> => {
    const response = await fetch(`${API_ROOT}/shipment/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, courierId }),
    });

    if (!response.ok) {
        throw new Error('Failed to create shipment');
    }
    return await response.json();
};
