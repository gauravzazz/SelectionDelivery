/**
 * Courier Registry
 * Loads all adapter instances. Only enabled adapters are returned.
 */

import { CourierAdapter } from './types';
import { DelhiveryAdapter } from './adapters/delhivery';
import { BluedartAdapter } from './adapters/bluedart';
import { DtdcAdapter } from './adapters/dtdc';
import { ShipyaariAdapter } from './adapters/shipyaari';
import { EkartAdapter } from './adapters/ekart';
import { ShipwayAdapter } from './adapters/shipway';

/** Master list — add new courier adapters here */
const ALL_ADAPTERS: CourierAdapter[] = [
    new DelhiveryAdapter(),
    new BluedartAdapter(),
    new DtdcAdapter(),
    new ShipyaariAdapter(),
    new EkartAdapter('SURFACE'),
    new EkartAdapter('EXPRESS'),
    new ShipwayAdapter(),
];

/**
 * Returns only enabled courier adapters.
 * Disabled couriers are never called.
 */
export function getEnabledAdapters(): CourierAdapter[] {
    return ALL_ADAPTERS.filter((a) => a.isEnabled());
}
