import { Router } from 'express';
import { db } from '../firebase';
import { ShipmentPayload } from '../courier/types';
import { DelhiveryAdapter } from '../courier/adapters/delhivery';
import { BluedartAdapter } from '../courier/adapters/bluedart';
import { EkartAdapter } from '../courier/adapters/ekart';
import { DtdcAdapter } from '../courier/adapters/dtdc';
import { ShipwayAdapter } from '../courier/adapters/shipway';
import { ShipyaariAdapter } from '../courier/adapters/shipyaari';

const router = Router();

const normalizeCourierId = (value: string): string => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'ekart') return 'ekart_surface';
    if (normalized === 'ekartsurface') return 'ekart_surface';
    if (normalized === 'ekartexpress') return 'ekart_express';
    return normalized;
};

// Cache adapters
const adapters: Record<string, any> = {
    delhivery: new DelhiveryAdapter(),
    bluedart: new BluedartAdapter(),
    dtdc: new DtdcAdapter(),
    shipway: new ShipwayAdapter(),
    ekart_surface: new EkartAdapter('SURFACE'),
    ekart_express: new EkartAdapter('EXPRESS'),
    shipyaari: new ShipyaariAdapter(),
};

router.post('/create', async (req, res): Promise<void> => {
    try {
        const { orderId, courierId } = req.body;

        if (!orderId) {
            res.status(400).json({ error: 'Missing orderId' });
            return;
        }

        // 1. Fetch Order
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const order = orderSnap.data() as any; // Typed loosely for now

        // 2. Select Courier
        const targetCourierIdRaw =
            courierId ||
            order.selectedCourierId ||
            order.trackingCourier;
        const targetCourierId = targetCourierIdRaw ? normalizeCourierId(targetCourierIdRaw) : '';
        if (!targetCourierId) {
            res.status(400).json({ error: 'No courier selected' });
            return;
        }

        // Handle variations like 'ekart surface' mapped to 'ekart'
        // For now direct mapping
        const adapter = adapters[targetCourierId];
        if (!adapter) {
            res.status(400).json({ error: 'Invalid or unsupported courier' });
            return;
        }

        // 3. Construct Payload
        const payload: ShipmentPayload = {
            orderId: orderId,
            courierId: targetCourierId,
            pickupAddress: {
                name: "PrintShip Store",
                phone: "9876543210",
                pincode: process.env.ORIGIN_PINCODE || "110001",
                address: "New Delhi, India"
            },
            deliveryAddress: {
                name: order.address.name,
                phone: order.address.phone,
                pincode: order.address.pincode,
                address: order.address.fullAddress || ""
            },
            items: order.items.map((item: any) => ({
                title: `${item.title} (${item.quantity} copies)`,
                quantity: item.quantity,
                price:
                    typeof item.unitPrice === 'number'
                        ? item.unitPrice
                        : (typeof item.totalPrice === 'number' && item.quantity > 0
                            ? item.totalPrice / item.quantity
                            : 0),
            })),
            weightGrams: order.weightGrams || 500, // Fallback
            paymentMethod: 'prepaid',
            amount: order.grandTotal
        };

        // 4. Create Shipment
        const shipment = await adapter.createShipment(payload);

        // 5. Update Order in Firestore
        await orderRef.update({
            status: 'confirmed',
            stage: 'shipped',
            trackingId: shipment.trackingId,
            trackingCourier: shipment.courierName,
            trackingLink: shipment.labelUrl || '', // or derive from ID
            labelUrl: shipment.labelUrl,
            selectedCourierId: targetCourierId,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, shipment });

    } catch (error: any) {
        console.error('Shipment creation failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.post('/cancel', async (req, res): Promise<void> => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            res.status(400).json({ error: 'Missing orderId' });
            return;
        }

        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const order = orderSnap.data() as any;
        const trackingId = order.trackingId;
        const courierId = order.selectedCourierId || order.trackingCourier;

        if (!trackingId || !courierId) {
            res.status(400).json({ error: 'Order has no tracking information to cancel' });
            return;
        }

        const adapter = adapters[normalizeCourierId(courierId)];
        if (!adapter) {
            res.status(400).json({ error: 'Unsupported courier for cancellation' });
            return;
        }

        const result = await adapter.cancelShipment(trackingId, orderId);
        if (result.success) {
            await orderRef.update({
                stage: 'ready_to_ship', // Rollback stage
                trackingId: null,
                labelUrl: null,
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true });
        } else {
            res.status(400).json({ error: result.message || 'Cancellation failed' });
        }
    } catch (error: any) {
        console.error('Shipment cancellation failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.get('/label/:orderId', async (req, res): Promise<void> => {
    try {
        const { orderId } = req.params;
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const order = orderSnap.data() as any;
        const trackingId = order.trackingId;
        const courierId = order.selectedCourierId || order.trackingCourier;

        if (!trackingId || !courierId) {
            res.status(400).json({ error: 'Order has no tracking info' });
            return;
        }

        const adapter = adapters[normalizeCourierId(courierId)];
        if (!adapter) {
            res.status(400).json({ error: 'Unsupported courier' });
            return;
        }

        const result = await adapter.getLabel(trackingId, orderId);
        res.json(result);
    } catch (error: any) {
        console.error('Failed to get label:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
