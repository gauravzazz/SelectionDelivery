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

export type OrderSource = 'pdf2printout' | 'onlineprintout.com';

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
    gsm: string;
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
    orderSource?: OrderSource;
    followUpAfterHours?: number;
    followUpStatus?: 'scheduled' | 'due' | 'snoozed' | 'paused' | 'done';
    lastOutboundMessageAt?: string;
    lastCustomerReplyAt?: string;
    nextFollowUpAt?: string;
    followUpCount?: number;
    trackingId?: string;
    trackingCourier?: string;
    trackingLink?: string;
    selectedCourierId?: string;
    paidAt?: string;
    notes?: string;
    labelUrl?: string;
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
                orderSource:
                    raw.orderSource === 'pdf2printout' || raw.orderSource === 'onlineprintout.com'
                        ? raw.orderSource
                        : undefined,
                followUpAfterHours: raw.followUpAfterHours,
                followUpStatus: raw.followUpStatus || (raw.status === 'draft' ? 'scheduled' : 'done'),
                lastOutboundMessageAt: raw.lastOutboundMessageAt,
                lastCustomerReplyAt: raw.lastCustomerReplyAt,
                nextFollowUpAt: raw.nextFollowUpAt,
                followUpCount: raw.followUpCount || 0,
                trackingId: raw.trackingId,
                trackingCourier: raw.trackingCourier,
                trackingLink: raw.trackingLink,
                selectedCourierId: raw.selectedCourierId,
                paidAt: raw.paidAt,
                notes: raw.notes,
                labelUrl: raw.labelUrl,
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
            followUpStatus: 'done',
            nextFollowUpAt: '',
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
    const fullText = raw.trim();
    const lines = fullText.split('\n').map((line) => line.trim()).filter(Boolean);

    const pincode = fullText.match(/\b(\d{6})\b/)?.[1] || '';

    const phoneRaw = fullText.match(/(?:\+?91[\s-]*)?(?:0)?([6-9]\d{9})\b/)?.[1] || '';
    const phone = phoneRaw.replace(/\D/g, '').slice(-10);

    const name =
        lines.find((line) => line.length < 50 && /[A-Za-z]/.test(line) && !/\d{3,}/.test(line)) || '';

    const cityLabel = fullText.match(/(?:city|district|dist)[:\s-]*([A-Za-z][A-Za-z.\s]+)/i)?.[1]?.trim() || '';
    const stateLabel = fullText.match(/(?:state)[:\s-]*([A-Za-z][A-Za-z.\s]+)/i)?.[1]?.trim() || '';

    const cityStateNearPin = pincode
        ? fullText.match(
            new RegExp(
                `([A-Za-z][A-Za-z.\\s]{1,40}),\\s*([A-Za-z][A-Za-z.\\s]{1,40})\\s*[-,]?\\s*${pincode}`,
                'i',
            ),
        )
        : null;

    const city = cityLabel || cityStateNearPin?.[1]?.trim() || '';
    const state = stateLabel || cityStateNearPin?.[2]?.trim() || '';

    const fullAddress = lines
        .join(', ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/,\s*,/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return {
        name,
        phone,
        pincode,
        city,
        state,
        fullAddress,
    };
}
