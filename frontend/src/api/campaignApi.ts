import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "review_leads";

export interface CampaignLead {
    name: string;
    phone: string;
    status: 'pending' | 'done';
    importedAt: string;
    updatedAt: string;
}

export const CampaignService = {
    async getPendingLeads(): Promise<CampaignLead[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as CampaignLead);
    },

    async markAsDone(phone: string): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, `lead_${phone}`);
        await updateDoc(docRef, {
            status: 'done',
            updatedAt: new Date().toISOString()
        });
    },

    async triggerImport(): Promise<any> {
        // We use the backend URL logic similar to shippingApi.ts
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = isLocal ? 'http://127.0.0.1:4000/api/campaign' : '/api/campaign';

        const response = await fetch(`${baseUrl}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to import campaign data');
        return response.json();
    }
};
