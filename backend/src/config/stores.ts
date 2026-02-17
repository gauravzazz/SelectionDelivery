/**
 * Store Pincode Configuration
 * Add new stores here — no code changes needed elsewhere.
 */

export interface StoreConfig {
    id: string;
    name: string;
    pincode: string;
    enabled: boolean;
}

export const STORES: StoreConfig[] = [
    {
        id: 'store-sw-1',
        name: 'Kolkata Hub',
        pincode: '741235',
        enabled: true,
    },
    {
        id: 'store-sw-2',
        name: 'Pune Hub',
        pincode: '411030',
        enabled: true,
    },
    {
        id: 'store-blr',
        // DISABLED as per user request
        name: 'Bangalore Warehouse',
        pincode: '560001',
        enabled: false,
    },
    {
        id: 'store-del',
        // DISABLED as per user request
        name: 'Delhi Warehouse',
        pincode: '110001',
        enabled: false,
    }
];

// CRITICAL: ONLY KOLKATA AND PUNE ARE AVAILABLE. DO NOT ENABLE OTHERS.

export const getEnabledStores = (): StoreConfig[] =>
    STORES.filter((s) => s.enabled);
