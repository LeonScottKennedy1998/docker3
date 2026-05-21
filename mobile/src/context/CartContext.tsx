import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine } from '../types/models';
import { useAuth } from './AuthContext';
import {
  fetchServerCartMobile,
  mergeCartLines,
  putServerCartMobile,
  serverCartDiffers,
} from '../api/cartApi';

function cartStorageKey(userId: number | undefined): string {
  if (userId != null && Number.isFinite(userId)) {
    return `mpt_mobile_cart_u_${userId}`;
  }
  return 'mpt_mobile_cart_guest';
}

type CartCtx = {
  cart: CartLine[];
  add: (line: CartLine, mergeQty?: boolean) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  totalQuantity: number;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, hydrated, token } = useAuth();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydratedForUser, setCartHydratedForUser] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const uid = userId;
    setCartHydratedForUser(false);
    setCart([]);

    void (async () => {
      const key = cartStorageKey(uid);
      let fromDevice: CartLine[] = [];
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) fromDevice = parsed as CartLine[];
        }
      } catch {
        fromDevice = [];
      }

      if (token && uid != null) {
        try {
          const server = await fetchServerCartMobile(token);
          const merged = mergeCartLines(server, fromDevice);
          if (serverCartDiffers(server, merged)) {
            try {
              await putServerCartMobile(token, merged);
            } catch {
            }
          }
          if (!cancelled) {
            setCart(merged);
            setCartHydratedForUser(true);
            await AsyncStorage.setItem(key, JSON.stringify(merged)).catch(() => {});
          }
          return;
        } catch {
          if (!cancelled) {
            setCart(fromDevice);
            setCartHydratedForUser(true);
          }
          return;
        }
      }

      if (!cancelled) {
        setCart(fromDevice);
        setCartHydratedForUser(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, userId, token]);

  useEffect(() => {
    if (!hydrated || !cartHydratedForUser) return;
    const key = cartStorageKey(userId);
    if (!token || userId == null) {
      AsyncStorage.setItem(key, JSON.stringify(cart)).catch(() => {});
      return;
    }
    const t = setTimeout(() => {
      void putServerCartMobile(token, cart)
        .then((items) => {
          AsyncStorage.setItem(key, JSON.stringify(items)).catch(() => {});
          if (serverCartDiffers(cart, items)) {
            setCart(items);
          }
        })
        .catch(() => {});
    }, 550);
    return () => clearTimeout(t);
  }, [cart, cartHydratedForUser, hydrated, token, userId]);

  const totalQuantity = useMemo(
    () => cart.reduce((s, line) => s + Math.max(0, line.quantity), 0),
    [cart]
  );

  const add = useCallback((line: CartLine, mergeQty = true) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === line.productId);
      if (i === -1) return [...prev, line];
      if (!mergeQty) return prev;
      const next = [...prev];
      next[i] = {
        ...next[i],
        quantity: next[i].quantity + line.quantity,
        price: line.price,
        name: line.name,
        ...(line.image_url != null ? { image_url: line.image_url } : {}),
      };
      return next;
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
  }, []);

  const setQty = useCallback(
    (productId: number, qty: number) => {
      if (qty < 1) {
        remove(productId);
        return;
      }
      setCart((prev) =>
        prev.map((x) => (x.productId === productId ? { ...x, quantity: qty } : x))
      );
    },
    [remove]
  );

  const clear = useCallback(() => setCart([]), []);

  const value = useMemo(
    () => ({ cart, add, remove, setQty, clear, totalQuantity }),
    [cart, add, remove, setQty, clear, totalQuantity]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('CartProvider отсутствует');
  return ctx;
}
