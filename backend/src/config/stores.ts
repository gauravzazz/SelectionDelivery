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
        id: 'store-blr',
        name: 'Bangalore Warehouse',
        pincode: '560001',
        enabled: true,
    },
    {
        id: 'store-del',
        name: 'Delhi Warehouse',
        pincode: '110001',
        enabled: true,
    },
    {
        id: 'store-sw-1',
        name: 'Shipway Origin 1',
        pincode: '741235',
        enabled: true,
    },
    {
        id: 'store-sw-2',
        name: 'Shipway Origin 2',
        pincode: '411030',
        enabled: true,
    },
];

export const getEnabledStores = (): StoreConfig[] =>
    STORES.filter((s) => s.enabled);
