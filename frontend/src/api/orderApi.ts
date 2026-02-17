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

export interface OrderItem {
    bookId: string;
    title: string;
    variant: 'color' | 'bw';
    quantity: number;
    unitPrice: number;
    pageCount: number;
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
    trackingId?: string;
    trackingCourier?: string;
    trackingLink?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

const COLLECTION_NAME = "orders";

export const OrderService = {
    async createDraft(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Order> {
        const now = new Date().toISOString();
        const data = {
            ...order,
            status: 'draft' as const,
            createdAt: now,
            updatedAt: now,
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
        return { id: docRef.id, ...data };
    },

    async getAllOrders(): Promise<Order[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        })) as Order[];
    },

    async confirmOrder(id: string, tracking: {
        trackingId: string;
        trackingCourier: string;
        trackingLink: string;
    }): Promise<void> {
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: 'confirmed',
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
