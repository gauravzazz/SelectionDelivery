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

const unique = (values: string[]) => Array.from(new Set(values));

const buildApiRoots = (raw?: string): string[] => {
    const primary = cleanBaseUrl(raw);
    const roots = [primary];

    // Support direct function URLs and proxied /api URLs seamlessly.
    if (primary.endsWith('/api')) {
        const withoutApi = primary.slice(0, -'/api'.length) || '';
        roots.push(withoutApi);
    } else {
        roots.push(`${primary}/api`);
    }

    return unique(roots.map((r) => r.replace(/\/$/, '')));
};

const DEFAULT_PROD_API_BASE = 'https://api-v4k6yqu5ia-uc.a.run.app';
const API_ROOTS = buildApiRoots(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? '/api' : DEFAULT_PROD_API_BASE),
);

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    for (const root of API_ROOTS) {
        const url = `${root}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(url, { ...(init || {}), signal: controller.signal });
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            const isJson = contentType.includes('application/json');

            if (res.ok && isJson) return res;

            // Keep trying fallback roots when route likely mismatched.
            if (res.status === 404 || res.status === 405 || (res.ok && !isJson)) {
                lastResponse = res;
                continue;
            }

            // Non-route errors (400/401/500 etc.) should surface immediately.
            return res;
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timeout);
        }
    }

    if (lastResponse) return lastResponse;
    if (lastError instanceof Error) throw lastError;
    throw new Error('Failed to reach shipping API');
}

export async function fetchShippingQuote(
    req: QuoteRequest,
): Promise<QuoteResponse> {
    const res = await fetchApi('/shipping-quote', {
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
    const res = await fetchApi(`/shipping-quote/options?_t=${Date.now()}`);
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
    const response = await fetchApi('/shipment/create', {
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

export const cancelShipment = async (orderId: string): Promise<{ success: boolean }> => {
    const response = await fetchApi('/shipment/cancel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Cancellation failed' }));
        throw new Error(err.error || 'Failed to cancel shipment');
    }
    return await response.json();
};

export const getShipmentLabel = async (orderId: string): Promise<{ labelUrl: string }> => {
    const response = await fetchApi(`/shipment/label/${orderId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch shipping label');
    }
    return await response.json();
};
