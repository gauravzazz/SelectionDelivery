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
                { title: 'Greeting', text: "Hello! Your order from OnlinePrintout.com is confirmed. We will ship it shortly." },
                { title: 'Shipping', text: "Your order has been shipped! Tracking ID: {trackingId}. Track here: {trackingLink}" },
                { title: 'Delayed', text: "Hi, there is a slight delay in your shipment. We apologize and will update you soon." },
                { title: 'Delivered', text: "Your order has been delivered. Enjoy reading! 📚" },
            ];
            for (const t of defaults) {
                await addDoc(collection(db, COLLECTION_NAME), t);
            }
        }
    }
};
