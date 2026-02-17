/**
 * Courier Enable/Disable Configuration
 * Toggle couriers on/off here — disabled couriers are never called.
 */

export interface CourierConfig {
    id: string;
    name: string;
    enabled: boolean;
}

export const COURIER_CONFIG: CourierConfig[] = [
    { id: 'delhivery', name: 'Delhivery', enabled: true },
    { id: 'bluedart', name: 'Bluedart', enabled: true },
    { id: 'dtdc', name: 'DTDC', enabled: true },
    { id: 'shipyaari', name: 'Shipyaari', enabled: true },
    { id: 'ekart_surface', name: 'Ekart Surface', enabled: true },
    { id: 'ekart_express', name: 'Ekart Express', enabled: true },
];

export const getEnabledCouriers = (): CourierConfig[] =>
    COURIER_CONFIG.filter((c) => c.enabled);
