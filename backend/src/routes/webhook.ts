import { Router } from 'express';
import { db } from '../firebase';

const router = Router();

router.post('/order', async (req, res): Promise<void> => {
    try {
        const webhookSecret = req.headers['x-webhook-secret'];
        const webhookEvent = req.headers['x-webhook-event'];

        const EXPECTED_SECRET = process.env.WEBHOOK_SECRET || 'your-secret';

        if (webhookSecret !== EXPECTED_SECRET) {
            res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
            return;
        }

        if (webhookEvent !== 'order.created') {
            res.status(400).json({ error: 'Unsupported webhook event' });
            return;
        }

        const payload = req.body;

        if (!payload || payload.event !== 'order.created' || !payload.data || !payload.data.orderId) {
            res.status(400).json({ error: 'Invalid payload structure' });
            return;
        }

        const orderData = payload.data;
        const { orderId } = orderData;

        // Map items to the internal OrderItem structure
        const mappedItems = (orderData.items || []).map((item: any) => {
            const quantity = item.config?.copies || 1;
            const unitPrice = item.itemTotal ? item.itemTotal / quantity : 0;
            return {
                bookId: item.fileId || `file_${Math.random().toString(36).substr(2, 9)}`,
                title: item.fileName || 'Uploaded Document',
                variant: item.config?.printColorMode === 'color' ? 'color' : 'bw',
                quantity: quantity,
                unitPrice: unitPrice,
                pageCount: item.pageCount || 0,
                itemType: 'custom',
                customConfig: {
                    printMode: item.config?.printColorMode === 'color' ? 'color' : 'bw',
                    pageSize: 'A4', // Default
                    gsm: item.config?.paperGSM || '75',
                    paperType: item.config?.paperType || 'standard',
                    bindingType: item.config?.bindingType || 'none'
                },
                // Keep references to access file contents later
                fileUrl: item.fileUrl,
                originalConfig: item.config
            };
        });

        const booksTotal = orderData.pricing?.subtotal || orderData.amount;
        const shippingCharge = orderData.pricing?.deliveryCost || 0;
        const grandTotal = orderData.pricing?.total || orderData.amount;

        // Map fields to match what the 'frontend' and 'shipment' routes expect
        const mappedOrder = {
            ...orderData,
            orderSource: 'onlineprintout.com',
            status: 'draft', // Saved as draft first, to be visibly reviewed
            stage: 'quote_shared',
            paymentStatus: orderData.status === 'PAID' ? 'paid' : 'pending',
            items: mappedItems,
            booksTotal: booksTotal,
            shippingCharge: shippingCharge,
            grandTotal: grandTotal,
            address: {
                ...orderData.address,
                pincode: orderData.address.zip || orderData.address.pincode || '',
                fullAddress: orderData.address.fullAddress ||
                    [orderData.address.street, orderData.address.city, orderData.address.zip].filter(Boolean).join(', ')
            },
            weightGrams: orderData.delivery?.weight ? orderData.delivery.weight * 1000 : 500,
            syncedAt: new Date().toISOString(),
            createdAt: orderData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to Firestore
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.set(mappedOrder, { merge: true });

        console.log(`[Webhook] Processed order.created for order: ${orderId}`);
        res.status(200).json({ success: true, message: 'Order processed successfully', orderId });

    } catch (error: any) {
        console.error('[Webhook] Error processing order webhook:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
