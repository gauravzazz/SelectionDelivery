import { Router } from 'express';
import { db } from '../firebase';
import { ShipmentPayload } from '../courier/types';
import { DelhiveryAdapter } from '../courier/adapters/delhivery';
import { BluedartAdapter } from '../courier/adapters/bluedart';
import { EkartAdapter } from '../courier/adapters/ekart';
import { ShipyaariAdapter } from '../courier/adapters/shipyaari';
import { getEnabledCouriers } from '../config/couriers';

const router = Router();

// Cache adapters
const adapters: Record<string, any> = {
    delhivery: new DelhiveryAdapter(),
    bluedart: new BluedartAdapter(),
    ekart: new EkartAdapter('SURFACE'), // Default surface
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
        const targetCourierId = courierId || order.trackingCourier?.toLowerCase();
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
                price: item.totalPrice / item.quantity
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
            trackingId: shipment.trackingId,
            trackingCourier: shipment.courierName,
            trackingLink: shipment.labelUrl || '', // or derive from ID
            labelUrl: shipment.labelUrl,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, shipment });

    } catch (error: any) {
        console.error('Shipment creation failed:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
