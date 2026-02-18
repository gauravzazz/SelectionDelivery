import type { MessageTemplate } from '../api/messageApi';
import type { OrderStage } from '../api/orderApi';

const STAGE_LABELS: Record<OrderStage, string> = {
    quote_shared: 'Quote Shared',
    awaiting_address: 'Awaiting Address',
    address_captured: 'Address Captured',
    awaiting_payment: 'Awaiting Payment',
    paid: 'Paid',
    printing: 'Printing',
    ready_to_ship: 'Ready To Ship',
    shipped: 'Shipped',
};

const STAGE_KEYWORDS: Record<OrderStage, string[]> = {
    quote_shared: ['quote shared', 'quote', 'ask pincode', 'draft reminder'],
    awaiting_address: ['ask full address', 'ask pincode', 'missing details', 'draft reminder', 'address'],
    address_captured: ['shipping option', 'payment details', 'payment reminder', 'awaiting payment'],
    awaiting_payment: ['payment details', 'payment reminder', 'payment', 'upi'],
    paid: ['payment received', 'printing started', 'thank you', 'order confirmed'],
    printing: ['printing started', 'ready to ship', 'printing'],
    ready_to_ship: ['ready to ship', 'shipping update', 'shipment'],
    shipped: ['shipping update', 'order delivered', 'feedback request', 'delivered'],
};

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function scoreTemplate(template: MessageTemplate, stage: OrderStage): number {
    const title = normalize(template.title);
    const text = normalize(template.text);
    const keywords = STAGE_KEYWORDS[stage] || [];

    let score = 0;
    for (const keyword of keywords) {
        if (!keyword) continue;
        if (title === keyword) score += 40;
        else if (title.startsWith(keyword)) score += 28;
        else if (title.includes(keyword)) score += 18;

        if (text.includes(keyword)) score += 7;
    }

    return score;
}

export function getStageLabel(stage: OrderStage): string {
    return STAGE_LABELS[stage] || stage;
}

export function sortTemplatesByStage(templates: MessageTemplate[], stage: OrderStage): MessageTemplate[] {
    if (!templates.length) return [];

    const withScores = templates.map((template, index) => ({
        template,
        index,
        score: scoreTemplate(template, stage),
    }));

    const hasPositiveScore = withScores.some((entry) => entry.score > 0);
    if (!hasPositiveScore) return templates;

    return withScores
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.index - b.index;
        })
        .map((entry) => entry.template);
}

export function pickSuggestedTemplate(templates: MessageTemplate[], stage: OrderStage): MessageTemplate | null {
    const ordered = sortTemplatesByStage(templates, stage);
    if (!ordered.length) return null;

    const first = ordered[0];
    if (scoreTemplate(first, stage) <= 0) return null;
    return first;
}

