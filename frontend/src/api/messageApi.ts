import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

export interface MessageTemplate {
    id: string;
    title: string;
    text: string;
}

const COLLECTION_NAME = 'message_templates';
const LOCAL_TEMPLATES_KEY = 'messageTemplatesLocal';

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
const slugify = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'template';

function createLocalTemplateId(prefix: string): string {
    return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTemplate(
    raw: any,
    fallbackId: string,
): MessageTemplate | null {
    if (!raw || typeof raw !== 'object') return null;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!title || !text) return null;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId;
    return { id, title, text };
}

function normalizeTemplateList(rawList: any[]): MessageTemplate[] {
    const seenIds = new Set<string>();
    const normalized: MessageTemplate[] = [];

    rawList.forEach((entry, index) => {
        const fallbackId = createLocalTemplateId(`entry-${index}`);
        const parsed = normalizeTemplate(entry, fallbackId);
        if (!parsed) return;
        let nextId = parsed.id;
        while (seenIds.has(nextId)) {
            nextId = createLocalTemplateId('dup');
        }
        seenIds.add(nextId);
        normalized.push({ ...parsed, id: nextId });
    });

    return normalized;
}

function ensureDefaultTemplates(templates: MessageTemplate[]): MessageTemplate[] {
    const byTitle = new Set(templates.map((template) => normalizeTitle(template.title)));
    const byId = new Set(templates.map((template) => template.id));
    const merged = [...templates];

    DEFAULT_TEMPLATES.forEach((template, index) => {
        if (byTitle.has(normalizeTitle(template.title))) return;
        let id = `default-${slugify(template.title)}`;
        if (!id) id = `default-${index + 1}`;
        while (byId.has(id)) {
            id = `${id}-${index + 1}`;
        }
        byId.add(id);
        byTitle.add(normalizeTitle(template.title));
        merged.push({
            id,
            title: template.title,
            text: template.text,
        });
    });

    return merged;
}

function readLocalTemplates(): MessageTemplate[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return ensureDefaultTemplates(normalizeTemplateList(parsed));
    } catch (_error) {
        return [];
    }
}

function writeLocalTemplates(templates: MessageTemplate[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(templates));
    } catch (_error) {
        // Ignore local storage failures.
    }
}

function upsertLocalTemplate(template: MessageTemplate): MessageTemplate[] {
    const existing = readLocalTemplates();
    const index = existing.findIndex((item) => item.id === template.id);
    const next = [...existing];
    if (index >= 0) {
        next[index] = template;
    } else {
        next.push(template);
    }
    const merged = ensureDefaultTemplates(next);
    writeLocalTemplates(merged);
    return merged;
}

function removeLocalTemplate(id: string): MessageTemplate[] {
    const existing = readLocalTemplates();
    const next = existing.filter((template) => template.id !== id);
    writeLocalTemplates(next);
    return next;
}

async function fetchRemoteTemplates(): Promise<MessageTemplate[]> {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const remote = normalizeTemplateList(
        snapshot.docs.map((docRef) => ({ id: docRef.id, ...docRef.data() })),
    );
    const existingTitles = new Set(remote.map((template) => normalizeTitle(template.title)));

    const missingDefaults = DEFAULT_TEMPLATES.filter(
        (template) => !existingTitles.has(normalizeTitle(template.title)),
    );

    if (missingDefaults.length > 0) {
        try {
            await Promise.all(
                missingDefaults.map((template) => addDoc(collection(db, COLLECTION_NAME), template)),
            );
            const refreshedSnapshot = await getDocs(collection(db, COLLECTION_NAME));
            return normalizeTemplateList(
                refreshedSnapshot.docs.map((docRef) => ({ id: docRef.id, ...docRef.data() })),
            );
        } catch (error) {
            console.warn('Failed to seed default templates in Firestore, using local defaults.', error);
        }
    }

    return ensureDefaultTemplates(remote);
}

export const MessageService = {
    getAll: async (): Promise<MessageTemplate[]> => {
        const local = readLocalTemplates();
        try {
            const remote = await fetchRemoteTemplates();
            const merged = ensureDefaultTemplates(remote);
            writeLocalTemplates(merged);
            return merged;
        } catch (error) {
            console.warn('Using local message templates because Firestore read failed.', error);
            const fallback = local.length > 0 ? local : ensureDefaultTemplates([]);
            writeLocalTemplates(fallback);
            return fallback;
        }
    },

    save: async (template: MessageTemplate) => {
        const normalized = normalizeTemplate(template, template.id || createLocalTemplateId('save'));
        if (!normalized) return;
        upsertLocalTemplate(normalized);
        try {
            await setDoc(doc(db, COLLECTION_NAME, normalized.id), {
                title: normalized.title,
                text: normalized.text,
            });
        } catch (error) {
            console.warn('Failed to sync template to Firestore, kept local copy.', error);
        }
    },

    add: async (title: string, text: string) => {
        const localTemplate = normalizeTemplate(
            {
                id: createLocalTemplateId('add'),
                title,
                text,
            },
            createLocalTemplateId('add'),
        );
        if (!localTemplate) {
            return {
                id: createLocalTemplateId('invalid'),
                title: title.trim(),
                text: text.trim(),
            };
        }

        upsertLocalTemplate(localTemplate);
        try {
            const ref = await addDoc(collection(db, COLLECTION_NAME), {
                title: localTemplate.title,
                text: localTemplate.text,
            });
            const remoteTemplate = { ...localTemplate, id: ref.id };
            removeLocalTemplate(localTemplate.id);
            upsertLocalTemplate(remoteTemplate);
            return remoteTemplate;
        } catch (error) {
            console.warn('Failed to add template in Firestore, kept local copy.', error);
            return localTemplate;
        }
    },

    delete: async (id: string) => {
        removeLocalTemplate(id);
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.warn('Failed to delete template in Firestore, removed local copy only.', error);
        }
    },

    ensureDefaults: async () => {
        const existing = readLocalTemplates();
        writeLocalTemplates(ensureDefaultTemplates(existing));
        try {
            await fetchRemoteTemplates();
        } catch (error) {
            console.warn('Could not ensure remote defaults. Local defaults are active.', error);
        }
    },

    // Backward-compat alias
    initializeDefaults: async () => {
        await MessageService.ensureDefaults();
    },
};
