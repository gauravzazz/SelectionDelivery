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
    { id: 'delhivery', name: 'Delhivery', enabled: false },
    { id: 'bluedart', name: 'Bluedart', enabled: false },
    { id: 'dtdc', name: 'DTDC', enabled: false },
    { id: 'shipyaari', name: 'Shipyaari', enabled: true },
    { id: 'ekart_surface', name: 'Ekart Surface', enabled: true },
    { id: 'ekart_express', name: 'Ekart Express', enabled: true },
    { id: 'shipway', name: 'Shipway', enabled: true },
    { id: 'shipmozo', name: 'Shipmozo', enabled: true },
    { id: 'shift', name: 'Shift', enabled: true },
];

export const getEnabledCouriers = (): CourierConfig[] =>
    COURIER_CONFIG.filter((c) => c.enabled);
