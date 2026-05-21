import { urls } from '../config/urls';
import { apiFetch, parseJsonSafe } from './client';
import type { CartLine } from '../types/models';

function lineSig(lines: CartLine[]): string {
    return [...lines]
        .map((l) => `${l.productId}:${l.quantity}`)
        .sort()
        .join('|');
}

export function mergeCartLines(server: CartLine[], local: CartLine[]): CartLine[] {
    const map = new Map<number, CartLine>();
    for (const s of server) {
        map.set(s.productId, { ...s });
    }
    for (const l of local) {
        const e = map.get(l.productId);
        if (!e) {
            map.set(l.productId, { ...l });
        } else {
            map.set(l.productId, {
                ...e,
                quantity: e.quantity + l.quantity,
                name: e.name || l.name,
                price: l.price ?? e.price,
                image_url: l.image_url ?? e.image_url,
            });
        }
    }
    return Array.from(map.values());
}

export async function fetchServerCartMobile(token: string): Promise<CartLine[]> {
    const res = await apiFetch(urls.cart.base, { method: 'GET', token, headers: {} });
    const data = (await parseJsonSafe(res)) as { items?: CartLine[]; error?: string };
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'cart get');
    return Array.isArray(data.items) ? data.items : [];
}

export async function putServerCartMobile(token: string, lines: CartLine[]): Promise<CartLine[]> {
    const res = await apiFetch(urls.cart.base, {
        method: 'PUT',
        token,
        headers: {},
        body: JSON.stringify({
            items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
    });
    const data = (await parseJsonSafe(res)) as { items?: CartLine[]; error?: string };
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'cart put');
    return Array.isArray(data.items) ? data.items : [];
}

export function serverCartDiffers(local: CartLine[], server: CartLine[]): boolean {
    return lineSig(local) !== lineSig(server);
}
