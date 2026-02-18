import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export interface OrderAddress {
    name: string;
    phone: string;
    pincode: string;
    city: string;
    state: string;
    fullAddress: string;
}

export type OrderStage =
    | 'quote_shared'
    | 'awaiting_address'
    | 'address_captured'
    | 'awaiting_payment'
    | 'paid'
    | 'printing'
    | 'ready_to_ship'
    | 'shipped';

export interface CustomPrintConfig {
    printMode: 'color' | 'bw';
    pageSize: string;
    paperType: string;
    bindingType: string;
}

export interface OrderItem {
    bookId: string;
    title: string;
    variant: 'color' | 'bw';
    quantity: number;
    unitPrice: number;
    pageCount: number;
    itemType?: 'catalog' | 'custom';
    customConfig?: CustomPrintConfig;
}

export interface Order {
    id: string;
    items: OrderItem[];
    address: OrderAddress;
    booksTotal: number;
    shippingCharge: number;
    courierName: string;
    adjustment: number;          // positive = markup, negative = discount
    adjustmentType: 'discount' | 'markup';
    grandTotal: number;
    weightGrams: number;
    status: 'draft' | 'confirmed';
    stage: OrderStage;
    paymentStatus: 'pending' | 'paid';
    paymentMode?: 'upi' | 'cash' | 'bank' | 'other';
    trackingId?: string;
    trackingCourier?: string;
    trackingLink?: string;
    selectedCourierId?: string;
    paidAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

const COLLECTION_NAME = "orders";

export const OrderService = {
    async createDraft(
        order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'stage' | 'paymentStatus'> & {
            stage?: OrderStage;
            paymentStatus?: 'pending' | 'paid';
        },
    ): Promise<Order> {
        const now = new Date().toISOString();
        const data = {
            ...order,
            status: 'draft' as const,
            stage: order.stage || 'quote_shared',
            paymentStatus: order.paymentStatus || 'pending',
            createdAt: now,
            updatedAt: now,
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
        return { id: docRef.id, ...data };
    },

    async getAllOrders(): Promise<Order[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const raw = d.data() as Partial<Order>;
            return {
                id: d.id,
                items: raw.items || [],
                address: raw.address || {
                    name: '',
                    phone: '',
                    pincode: '',
                    city: '',
                    state: '',
                    fullAddress: '',
                },
                booksTotal: raw.booksTotal || 0,
                shippingCharge: raw.shippingCharge || 0,
                courierName: raw.courierName || 'TBD',
                adjustment: raw.adjustment || 0,
                adjustmentType: raw.adjustmentType || 'discount',
                grandTotal: raw.grandTotal || 0,
                weightGrams: raw.weightGrams || 0,
                status: raw.status || 'draft',
                stage: raw.stage || (raw.status === 'confirmed' ? 'shipped' : 'quote_shared'),
                paymentStatus: raw.paymentStatus || 'pending',
                paymentMode: raw.paymentMode,
                trackingId: raw.trackingId,
                trackingCourier: raw.trackingCourier,
                trackingLink: raw.trackingLink,
                selectedCourierId: raw.selectedCourierId,
                paidAt: raw.paidAt,
                notes: raw.notes,
                createdAt: raw.createdAt || new Date().toISOString(),
                updatedAt: raw.updatedAt || new Date().toISOString(),
            };
        });
    },

    async confirmOrder(id: string, tracking: {
        trackingId: string;
        trackingCourier: string;
        trackingLink: string;
    }): Promise<void> {
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: 'confirmed',
            stage: 'shipped',
            ...tracking,
            updatedAt: new Date().toISOString(),
        });
    },

    async updateOrder(id: string, data: Partial<Order>): Promise<void> {
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            ...data,
            updatedAt: new Date().toISOString(),
        });
    },

    async deleteOrder(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
};

/** Parse raw pasted text into structured address fields */
export function parseAddress(raw: string): Partial<OrderAddress> {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const fullText = raw.trim();

    // Extract pincode (6 digits)
    const pincodeMatch = fullText.match(/\b(\d{6})\b/);
    const pincode = pincodeMatch?.[1] || '';

    // Extract phone (10 digits, optionally with +91 / 0 prefix)
    const phoneMatch = fullText.match(/(?:\+91[\s-]?|0)?([6-9]\d{9})\b/);
    const phone = phoneMatch?.[1] || '';

    // Heuristic: first line is usually the name
    let name = '';
    if (lines.length > 0) {
        const firstLine = lines[0];
        // If first line doesn't look like an address (no numbers, short enough)
        if (firstLine.length < 40 && !/\d{3,}/.test(firstLine)) {
            name = firstLine;
        }
    }

    // Try to extract city/state from common patterns
    let city = '';
    let state = '';
    const cityStateMatch = fullText.match(/(?:city|dist(?:rict)?)[:\s-]*([A-Za-z\s]+)/i);
    if (cityStateMatch) city = cityStateMatch[1].trim();

    const stateMatch = fullText.match(/(?:state)[:\s-]*([A-Za-z\s]+)/i);
    if (stateMatch) state = stateMatch[1].trim();

    // Build full address from all lines except the name line
    const addressLines = name ? lines.slice(1) : lines;
    const fullAddress = addressLines.join(', ');

    return {
        name,
        phone,
        pincode,
        city,
        state,
        fullAddress,
    };
}
