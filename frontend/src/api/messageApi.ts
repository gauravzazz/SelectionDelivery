import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

export interface MessageTemplate {
    id: string;
    title: string;
    text: string;
}

const COLLECTION_NAME = 'message_templates';

export const MessageService = {
    getAll: async (): Promise<MessageTemplate[]> => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate));
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

    // Initialize defaults if empty
    initializeDefaults: async () => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        if (snapshot.empty) {
            const defaults = [
                {
                    title: 'Draft Reminder',
                    text: "Hi {name}, you have a draft order on OnlinePrintout.com. Complete your order here now to get it delivered faster! 📚"
                },
                {
                    title: 'Order Confirmed',
                    text: "Hello {name}! Your order from OnlinePrintout.com is confirmed. We will ship it within 24-48 hours. Thank you! 🙏"
                },
                {
                    title: 'Shipping Update',
                    text: "Great news {name}! Your order has been shipped via {trackingCourier}. Tracking ID: {trackingId}. Track here: {trackingLink}"
                },
                {
                    title: 'Order Delayed',
                    text: "Hi {name}, there is a slight delay in your shipment due to heavy load. We apologize for the wait and will update you soon."
                },
                {
                    title: 'Order Delivered',
                    text: "Hi {name}, your order has been delivered. We hope you love the print quality! Enjoy reading! 📚✨"
                },
                {
                    title: 'Feedback Request',
                    text: "Hi {name}, hope you liked our service! Please share your feedback: [Link]. Your reviews help us grow! 🙏"
                },
            ];
            for (const t of defaults) {
                await addDoc(collection(db, COLLECTION_NAME), t);
            }
        }
    }
};
