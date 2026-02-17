/**
 * Multi-Store Courier Aggregation Service
 *
 * For each enabled store × each enabled courier → fetch quote
 * Optionally filters to specific couriers if courierIds provided.
 * Then rank by cheapest and fastest.
 */

import { getEnabledStores } from '../config/stores';
import { getEnabledAdapters } from '../courier/registry';
import { CourierQuote, CourierPayload } from '../courier/types';

export interface ShippingOption extends CourierQuote {
    storePincode: string;
    storeName: string;
}

export interface AggregatedResult {
    cheapest: ShippingOption | null;
    fastest: ShippingOption | null;
    allOptions: ShippingOption[];
    weightGrams: number;
}

export async function aggregateShippingQuotes(
    destinationPincode: string,
    weightGrams: number,
    courierIds?: string[],
): Promise<AggregatedResult> {
    const stores = getEnabledStores();
    let adapters = getEnabledAdapters();

    // Filter to specific couriers if requested
    if (courierIds && courierIds.length > 0) {
        adapters = adapters.filter((a) => courierIds.includes(a.id));
    }

    const quotePromises: Promise<ShippingOption | null>[] = [];

    for (const store of stores) {
        for (const adapter of adapters) {
            const payload: CourierPayload = {
                originPincode: store.pincode,
                destinationPincode,
                weightGrams,
            };

            // Each call is isolated — one failure doesn't crash the system
            quotePromises.push(
                adapter
                    .getQuote(payload)
                    .then((quote): ShippingOption => ({
                        ...quote,
                        storePincode: store.pincode,
                        storeName: store.name,
                    }))
                    .catch((err) => {
                        console.error(
                            `[Aggregation] Failed: ${adapter.name} from ${store.pincode}`,
                            err,
                        );
                        return null;
                    }),
            );
        }
    }

    const results = await Promise.all(quotePromises);
    const validOptions = results.filter(
        (r): r is ShippingOption => r !== null && r.available,
    );

    // Sort copies for ranking
    const byCost = [...validOptions].sort((a, b) => a.price - b.price);
    const bySpeed = [...validOptions].sort(
        (a, b) => a.deliveryDays - b.deliveryDays || a.price - b.price,
    );

    return {
        cheapest: byCost[0] ?? null,
        fastest: bySpeed[0] ?? null,
        allOptions: validOptions,
        weightGrams,
    };
}
