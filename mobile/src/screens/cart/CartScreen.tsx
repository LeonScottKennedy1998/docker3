import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import type { MainTabParamList } from '../../navigation/types';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';
import type { BatchProductApi } from '../../api/types';
import { formatRub, toFiniteNumber } from '../../utils/money';

type Props = BottomTabScreenProps<MainTabParamList, 'Cart'>;

function linePrice(
  line: { productId: number; price: number; quantity: number },
  batch: Map<number, BatchProductApi>
): number {
  const p = batch.get(line.productId);
  const unit = toFiniteNumber(line.price);
  if (p?.has_discount && p.final_price != null) {
    return toFiniteNumber(p.final_price) * line.quantity;
  }
  return unit * line.quantity;
}

function lineImage(
  line: { productId: number; image_url?: string },
  batch: Map<number, BatchProductApi>
): string | undefined {
  const fromLine = line.image_url?.trim();
  if (fromLine) return fromLine;
  const p = batch.get(line.productId);
  if (!p) return undefined;
  if (p.image_url?.trim()) return p.image_url.trim();
  if (p.images?.[0]) return p.images[0];
  return undefined;
}

export function CartScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { token, user } = useAuth();
  const { cart, remove, setQty, clear } = useCart();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [batch, setBatch] = useState<Map<number, BatchProductApi>>(new Map());
  const [batchLoading, setBatchLoading] = useState(false);
  const batchCartSigRef = useRef<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  const refreshBatch = useCallback(async () => {
    if (cart.length === 0) {
      batchCartSigRef.current = '';
      setBatch(new Map());
      return;
    }
    const productIds = cart.map((x) => x.productId);
    const requestSig = [...new Set(productIds)].sort((a, b) => a - b).join(',');
    setBatchLoading(true);
    try {
      const res = await apiFetch(urls.products.batch, {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ productIds }),
        token: token ?? undefined,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !Array.isArray(data)) return;
      const map = new Map<number, BatchProductApi>();
      (data as BatchProductApi[]).forEach((p) => map.set(p.id, p));
      batchCartSigRef.current = requestSig;
      setBatch(map);
    } catch {
    } finally {
      setBatchLoading(false);
    }
  }, [cart, token]);

  useEffect(() => {
    void refreshBatch();
  }, [refreshBatch]);

  useFocusEffect(
    useCallback(() => {
      void refreshBatch();
    }, [refreshBatch])
  );

  useEffect(() => {
    if (batchLoading || cart.length === 0) return;
    const cartSig = [...new Set(cart.map((l) => l.productId))].sort((a, b) => a - b).join(',');
    if (batchCartSigRef.current !== cartSig || batch.size === 0) return;
    for (const line of cart) {
      const p = batch.get(line.productId);
      if (!p || p.stock <= 0) {
        remove(line.productId);
        continue;
      }
      if (line.quantity > p.stock) {
        setQty(line.productId, p.stock);
      }
    }
  }, [batch, batchLoading, cart, remove, setQty]);

  const total = useMemo(
    () => cart.reduce((s, line) => s + linePrice(line, batch), 0),
    [cart, batch]
  );

  const submit = async () => {
    setErr('');
    if (cart.length === 0) {
      setErr('Корзина пуста');
      return;
    }
    const ph = phone.trim();
    if (!ph) {
      setErr('Укажите телефон');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(urls.orders.create, {
        method: 'POST',
        token,
        body: JSON.stringify({
          items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity })),
          phone: ph,
        }),
      });
      const data = (await parseJsonSafe(res)) as {
        error?: string;
        order?: { id: number };
      };
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка оформления');
      }
      const id = data.order?.id;
      clear();
      if (id != null) {
        navigation.navigate('Profile', {
          screen: 'OrderSuccess',
          params: { orderId: id },
        });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.appBg }]}>
        <Text style={[styles.h1, { color: c.heading }]}>Корзина пуста</Text>
        <PrimaryButton
          title="В каталог"
          onPress={() => navigation.navigate('Catalog', { screen: 'CatalogList' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      {batchLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginBottom: 8 }} />
      ) : null}
      {cart.map((line) => {
        const row = linePrice(line, batch) / line.quantity;
        const uri = lineImage(line, batch);
        const p = batch.get(line.productId);
        const stock = p?.stock ?? 0;
        const atMax = p != null && line.quantity >= stock;
        return (
          <View
            key={line.productId}
            style={[styles.row, { borderColor: c.border, backgroundColor: c.card }]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: c.surface }]} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
                {line.name}
              </Text>
              {p != null && stock > 0 ? (
                <Text style={{ color: c.muted, marginTop: 4, fontSize: 12 }}>
                  На складе: {stock} шт.
                </Text>
              ) : batch.size > 0 && !batchLoading ? (
                <Text style={{ color: c.danger, marginTop: 4, fontSize: 12 }}>
                  Нет в наличии — позиция будет убрана
                </Text>
              ) : null}
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {formatRub(row)} × {line.quantity} = {formatRub(linePrice(line, batch))}
              </Text>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => setQty(line.productId, line.quantity - 1)}
                  style={[styles.qtyBtn, { borderColor: c.border }]}
                >
                  <Text style={{ color: c.text }}>−</Text>
                </Pressable>
                <Text style={[styles.qty, { color: c.text }]}>{line.quantity}</Text>
                <Pressable
                  onPress={() => setQty(line.productId, line.quantity + 1)}
                  disabled={atMax || stock <= 0}
                  style={[
                    styles.qtyBtn,
                    { borderColor: c.border, opacity: atMax || stock <= 0 ? 0.35 : 1 },
                  ]}
                >
                  <Text style={{ color: c.text }}>+</Text>
                </Pressable>
              </View>
            </View>
            <Pressable onPress={() => remove(line.productId)} hitSlop={8}>
              <Text style={{ color: c.danger }}>Удалить</Text>
            </Pressable>
          </View>
        );
      })}

      <Text style={[styles.total, { color: c.heading }]}>Итого: {formatRub(total)}</Text>

      <Field label="Телефон для связи" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}

      <PrimaryButton title="Оформить заказ" loading={submitting} onPress={() => void submit()} />
      <PrimaryButton
        title="Очистить корзину"
        variant="outline"
        onPress={() => clear()}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  h1: { fontSize: 20, marginBottom: 16 },
  pad: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontSize: 16, minWidth: 24, textAlign: 'center' },
  total: { fontSize: 20, fontWeight: '700', marginVertical: 16 },
});
