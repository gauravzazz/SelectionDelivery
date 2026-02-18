import type { Order } from '../api/orderApi';

export const FOLLOWUP_HOURS_LOCAL_KEY = 'followupSchedulerHours';
export const DEFAULT_FOLLOWUP_HOURS = 6;

export function sanitizeFollowUpHours(hours: number): number {
    const parsed = Number(hours);
    if (!Number.isFinite(parsed)) return DEFAULT_FOLLOWUP_HOURS;
    return Math.min(72, Math.max(1, Math.round(parsed)));
}

export function readFollowUpHours(): number {
    if (typeof window === 'undefined') return DEFAULT_FOLLOWUP_HOURS;
    try {
        const raw = localStorage.getItem(FOLLOWUP_HOURS_LOCAL_KEY);
        if (!raw) return DEFAULT_FOLLOWUP_HOURS;
        return sanitizeFollowUpHours(Number(raw));
    } catch (_error) {
        return DEFAULT_FOLLOWUP_HOURS;
    }
}

export function writeFollowUpHours(hours: number): number {
    const safe = sanitizeFollowUpHours(hours);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(FOLLOWUP_HOURS_LOCAL_KEY, String(safe));
        } catch (_error) {
            // Ignore local storage write issues.
        }
    }
    return safe;
}

export function addHoursIso(baseIso: string, hours: number): string {
    const base = new Date(baseIso);
    if (Number.isNaN(base.getTime())) return new Date().toISOString();
    const safeHours = sanitizeFollowUpHours(hours);
    return new Date(base.getTime() + safeHours * 60 * 60 * 1000).toISOString();
}

export function getOrderFollowUpHours(order: Partial<Order>, fallbackHours: number): number {
    return sanitizeFollowUpHours(order.followUpAfterHours || fallbackHours);
}

export function isFollowUpActive(order: Partial<Order>): boolean {
    return order.followUpStatus !== 'done' && order.followUpStatus !== 'paused';
}

export function buildNextFollowUpAt(order: Partial<Order>, fallbackHours: number, nowIso?: string): string {
    const base = nowIso || order.lastOutboundMessageAt || order.updatedAt || order.createdAt || new Date().toISOString();
    return addHoursIso(base, getOrderFollowUpHours(order, fallbackHours));
}

