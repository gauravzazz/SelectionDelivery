import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

export interface MessageTemplate {
    id: string;
    title: string;
    text: string;
}

const COLLECTION_NAME = 'message_templates';

export const MESSAGE_TEMPLATE_SAMPLES: Array<Omit<MessageTemplate, 'id'>> = [
    {
        title: 'Quote Shared',
        text: "Hi {name}, your print quote is ready. Grand total is Rs {grandTotal}. Reply YES to proceed.",
    },
    {
        title: 'Ask Pincode',
        text: "Hi {name}, please share 6-digit delivery pincode so I can check the best courier option.",
    },
    {
        title: 'Shipping Option',
        text: "Best shipping option for your order: {courier} (Rs {shipping}). Updated total: Rs {grandTotal}.",
    },
    {
        title: 'Ask Full Address',
        text: "Please share full delivery address in one message: Name, Phone, House/Street, Area, City, State, Pincode.",
    },
    {
        title: 'Missing Details Follow-up',
        text: "Hi {name}, to complete your order I still need missing details. Please share complete address and active mobile number.",
    },
    {
        title: 'Draft Reminder',
        text: "Hi {name}, your draft order is ready. Share your address and we will proceed quickly.",
    },
    {
        title: 'Payment Details',
        text: "Hi {name}, your total amount is ₹{grandTotal}. Please complete payment and share screenshot to confirm your order.",
    },
    {
        title: 'Payment Reminder',
        text: "Quick reminder: payment of Rs {grandTotal} is pending for your order. Share screenshot once paid.",
    },
    {
        title: 'Payment Received',
        text: "Payment received successfully. Thank you {name}. We are starting your print job now.",
    },
    {
        title: 'Printing Started',
        text: "Update: your order is in printing stage. We will notify you once it is packed and ready to ship.",
    },
    {
        title: 'Ready To Ship',
        text: "Your order is printed and packed. We are creating shipment now and will share tracking details shortly.",
    },
    {
        title: 'Thank You',
        text: "Thank you {name} for choosing us. Your order is in process and we appreciate your trust.",
    },
    {
        title: 'Order Confirmed',
        text: "Hello {name}! Your order #{orderId} is confirmed. We will ship it soon.",
    },
    {
        title: 'Shipping Update',
        text: "Great news {name}! Shipped via {trackingCourier}. Tracking ID: {trackingId}. Track: {trackingLink}",
    },
    {
        title: 'Order Delayed',
        text: "Hi {name}, your order is slightly delayed. We are working to dispatch it as soon as possible.",
    },
    {
        title: 'Order Delivered',
        text: "Hi {name}, your order has been delivered. Thank you and we hope you loved the print quality.",
    },
    {
        title: 'Feedback Request',
        text: "Hi {name}, thank you for ordering with us. Please share your feedback and rating.",
    },
];

const DEFAULT_TEMPLATES = MESSAGE_TEMPLATE_SAMPLES;

const normalizeTitle = (title: string) => title.trim().toLowerCase();

export const MessageService = {
    getAll: async (): Promise<MessageTemplate[]> => {
        await MessageService.ensureDefaults();
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map((docRef) => ({ id: docRef.id, ...docRef.data() } as MessageTemplate));
    },

    save: async (template: MessageTemplate) => {
        await setDoc(doc(db, COLLECTION_NAME, template.id), {
            title: template.title,
            text: template.text
        });
    },

    add: async (title: string, text: string) => {
        const ref = await addDoc(collection(db, COLLECTION_NAME), { title, text });
        return { id: ref.id, title, text };
    },

    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    ensureDefaults: async () => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const existingTitles = new Set(
            snapshot.docs
                .map((docRef) => String(docRef.data().title || ''))
                .filter(Boolean)
                .map(normalizeTitle),
        );

        for (const template of DEFAULT_TEMPLATES) {
            if (!existingTitles.has(normalizeTitle(template.title))) {
                await addDoc(collection(db, COLLECTION_NAME), template);
            }
        }
    },

    // Backward-compat alias
    initializeDefaults: async () => {
        await MessageService.ensureDefaults();
    },
};
