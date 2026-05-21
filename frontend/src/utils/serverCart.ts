import { API_URLS } from '../config/api';
import type { CartItem } from '../types/product';

export const GUEST_CART_KEY = 'mpt_cart_guest';
export const LEGACY_CART_KEY = 'cart';

export function readGuestCart(): CartItem[] {
    try {
        const g = localStorage.getItem(GUEST_CART_KEY);
        if (g) {
            const p = JSON.parse(g) as unknown;
            return Array.isArray(p) ? (p as CartItem[]) : [];
        }
        const legacy = localStorage.getItem(LEGACY_CART_KEY);
        if (legacy) {
            localStorage.setItem(GUEST_CART_KEY, legacy);
            localStorage.removeItem(LEGACY_CART_KEY);
            const p = JSON.parse(legacy) as unknown;
            return Array.isArray(p) ? (p as CartItem[]) : [];
        }
    } catch {
    }
    return [];
}

export function writeGuestCart(items: CartItem[]) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function clearGuestCart() {
    localStorage.removeItem(GUEST_CART_KEY);
    localStorage.removeItem(LEGACY_CART_KEY);
}

export function userCartCacheKey(userId: number) {
    return `mpt_cart_u_${userId}`;
}

export function mergeCarts(server: CartItem[], local: CartItem[]): CartItem[] {
    const map = new Map<number, CartItem>();
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
                price: e.price || l.price,
            });
        }
    }
    return Array.from(map.values());
}

function sortSig(items: CartItem[]): string {
    return [...items]
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join('|');
}

export async function fetchServerCart(token: string): Promise<CartItem[]> {
    const res = await fetch(API_URLS.CART.BASE, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { items?: CartItem[]; error?: string };
    if (!res.ok) throw new Error(data.error || 'cart get');
    return Array.isArray(data.items) ? data.items : [];
}

export async function putServerCart(token: string, items: CartItem[]): Promise<CartItem[]> {
    const body = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };
    const res = await fetch(API_URLS.CART.BASE, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { items?: CartItem[]; error?: string };
    if (!res.ok) throw new Error(data.error || 'cart put');
    return Array.isArray(data.items) ? data.items : [];
}

/** Save cart for logged-in user and sync `userCartCacheKey`, so SPA reload preserves items. */
export async function persistLoggedInCart(token: string, items: CartItem[]): Promise<CartItem[]> {
    const saved = await putServerCart(token, items);
    try {
        const rawUser = localStorage.getItem('user');
        const uid = rawUser ? (JSON.parse(rawUser) as { id?: number }).id : undefined;
        if (uid != null) {
            localStorage.setItem(userCartCacheKey(uid), JSON.stringify(saved));
        }
    } catch {
        /* ignore */
    }
    return saved;
}

export async function mergeGuestCartWithServer(
    token: string,
    reactCart?: CartItem[] | null
): Promise<CartItem[]> {
    const fromStorage = readGuestCart();
    const localGuest =
        reactCart && reactCart.length ? mergeCarts(fromStorage, reactCart) : fromStorage;
    const server = await fetchServerCart(token);
    const merged = localGuest.length > 0 ? mergeCarts(server, localGuest) : server;
    const saved = await putServerCart(token, merged);
    clearGuestCart();
    return saved;
}

export function cartNeedsReplaceFromServer(local: CartItem[], server: CartItem[]): boolean {
    return sortSig(local) !== sortSig(server);
}
