import axios from 'axios';
import { ShipmozoAdapter } from '../shipmozo';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ShipmozoAdapter', () => {
    let adapter: ShipmozoAdapter;

    beforeEach(() => {
        adapter = new ShipmozoAdapter();
        jest.clearAllMocks();
    });

    it('should fetch a quote correctly', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { rate: '150.50' }
        });

        const quote = await adapter.getQuote({
            originPincode: '110001',
            destinationPincode: '400001',
            weightGrams: 500
        });

        expect(quote.courierId).toBe('shipmozo');
        expect(quote.price).toBe(150.50);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://shipping-api.com/app/api/v1/rate-calculator',
            expect.objectContaining({
                pickup_pincode: '110001',
                delivery_pincode: '400001',
                weight: '500'
            }),
            expect.any(Object)
        );
    });

    it('should create a shipment correctly', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { data: { refrence_id: 'TRK123456' } }
        });

        const shipment = await adapter.createShipment({
            orderId: 'ORD-001',
            courierId: 'shipmozo',
            pickupAddress: { name: 'Store', phone: '12345', pincode: '110001', address: 'Delhi' },
            deliveryAddress: { name: 'John Doe', phone: '9876543210', pincode: '400001', address: 'Mumbai' },
            items: [{ title: 'Book', quantity: 2, price: 500 }],
            weightGrams: 1000,
            paymentMethod: 'prepaid',
            amount: 1000
        });

        expect(shipment.trackingId).toBe('TRK123456');
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://shipping-api.com/app/api/v1/push-order',
            expect.objectContaining({
                order_id: 'ORD-001',
                consignee_name: 'John Doe'
            }),
            expect.any(Object)
        );
    });

    it('should fetch a label correctly', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { data: { label_url: 'https://shipping-api.com/label.pdf' } }
        });

        const label = await adapter.getLabel('TRK123456');

        expect(label.labelUrl).toBe('https://shipping-api.com/label.pdf');
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://shipping-api.com/app/api/v1/get-order-label/TRK123456?type_of_label=PDF',
            expect.any(Object)
        );
    });

    it('should handle cancellation correctly', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { result: '1', message: 'Success' }
        });

        const cancel = await adapter.cancelShipment('TRK123456', 'ORD-001');

        expect(cancel.success).toBe(true);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://shipping-api.com/app/api/v1/cancel-order',
            { order_id: 'ORD-001', awb_number: 'TRK123456' },
            expect.any(Object)
        );
    });

    it('should track shipment correctly', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { status: 'Delivered' }
        });

        const tracking = await adapter.trackShipment('TRK123456');

        expect(tracking.status).toBe('Delivered');
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://shipping-api.com/app/api/v1/track-order?awb_number=TRK123456',
            expect.any(Object)
        );
    });
});
