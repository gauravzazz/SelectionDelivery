"use strict";
/**
 * Courier Enable/Disable Configuration
 * Toggle couriers on/off here — disabled couriers are never called.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnabledCouriers = exports.COURIER_CONFIG = void 0;
exports.COURIER_CONFIG = [
    { id: 'delhivery', name: 'Delhivery', enabled: true },
    { id: 'bluedart', name: 'Bluedart', enabled: true },
    { id: 'dtdc', name: 'DTDC', enabled: true },
    { id: 'shipyaari', name: 'Shipyaari', enabled: true },
    { id: 'ekart_surface', name: 'Ekart Surface', enabled: true },
    { id: 'ekart_express', name: 'Ekart Express', enabled: true },
    { id: 'shipway', name: 'Shipway', enabled: true },
    { id: 'shipmozo', name: 'Shipmozo', enabled: true },
];
var getEnabledCouriers = function () {
    return exports.COURIER_CONFIG.filter(function (c) { return c.enabled; });
};
exports.getEnabledCouriers = getEnabledCouriers;
