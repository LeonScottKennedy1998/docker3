import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import type { BatchProductApi, OrderRowApi } from '../../api/types';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useFocusEffect } from '@react-navigation/native';
import { formatRub } from '../../utils/money';
import type { MainTabParamList } from '../../navigation/types';
import { toFiniteNumber } from '../../utils/money';

type Props = BottomTabScreenProps<MainTabParamList, 'Orders'>;

export function OrdersScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const { add } = useCart();
  const [orders, setOrders] = useState<OrderRowApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch(urls.orders.my, { method: 'GET', token });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка';
        setErr(msg);
        return;
      }
      if (!Array.isArray(data)) setOrders([]);
      else setOrders(data as OrderRowApi[]);
    } catch {
      setErr('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const reorder = async (o: OrderRowApi) => {
    const items = o.items ?? [];
    if (items.length === 0) {
      Alert.alert('Заказ пуст', 'В этом заказе нет позиций для повторения.');
      return;
    }
    if (!token) return;
    const uniqueIds = [...new Set(items.map((row) => row.product_id))];
    try {
      const res = await apiFetch(urls.products.batch, {
        method: 'POST',
        body: JSON.stringify({ productIds: uniqueIds }),
        token,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !Array.isArray(data)) {
        Alert.alert('Ошибка', 'Не удалось проверить наличие товаров.');
        return;
      }
      const list = data as BatchProductApi[];
      const byId = new Map(list.map((p) => [p.id, p]));
      const skipped: string[] = [];
      let added = 0;
      for (const row of items) {
        const p = byId.get(row.product_id);
        if (!p || p.stock <= 0) {
          skipped.push(row.product_name);
          continue;
        }
        const qty = Math.min(row.quantity, p.stock);
        const unit =
          p.has_discount && p.final_price != null
            ? toFiniteNumber(p.final_price)
            : toFiniteNumber(p.price);
        add(
          {
            productId: p.id,
            name: p.name,
            price: unit,
            quantity: qty,
            image_url: p.image_url ?? p.images?.[0],
          },
          true
        );
        added += 1;
      }
      if (added === 0) {
        Alert.alert(
          'Нет в наличии',
          skipped.length
            ? `Товары закончились или сняты с продажи:\n${skipped.join(', ')}`
            : 'Не удалось добавить позиции.'
        );
        return;
      }
      if (skipped.length > 0) {
        Alert.alert(
          'Часть товаров недоступна',
          `Нет в наличии:\n${skipped.join(', ')}\n\nОстальное добавлено в корзину.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Cart') }]
        );
        return;
      }
      navigation.navigate('Cart');
    } catch {
      Alert.alert('Ошибка', 'Сеть недоступна');
    }
  };

  const openProduct = (productId: number) => {
    navigation.navigate('Catalog', {
      screen: 'ProductDetail',
      params: { productId },
    });
  };

  const renderOrder = ({ item }: { item: OrderRowApi }) => (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.orderTitle, { color: c.text }]}>Заказ №{item.id}</Text>
      <Text style={{ color: c.muted, marginBottom: 8 }}>
        {new Date(item.created_at).toLocaleString('ru-RU')} · {item.status}
      </Text>
      <Text style={{ color: c.muted, marginBottom: 12 }}>Сумма: {formatRub(item.total)}</Text>
      {(item.items ?? []).slice(0, 8).map((row) => (
        <Pressable
          key={row.id}
          onPress={() => openProduct(row.product_id)}
          style={({ pressed }) => [styles.lineItem, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: c.primary, textDecorationLine: 'underline', flexShrink: 1 }}>
            {row.product_name}
          </Text>
          <Text style={{ color: c.muted, marginLeft: 8 }}>
            × {row.quantity} · {formatRub(row.price)}
          </Text>
        </Pressable>
      ))}
      {(item.items ?? []).length > 8 ? <Text style={{ color: c.muted }}>…</Text> : null}
      <Pressable
        onPress={() => void reorder(item)}
        style={[styles.reBtn, { borderColor: c.primary }]}
      >
        <Text style={{ color: c.primary, fontWeight: '600' }}>Повторить в корзине</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (err) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg, padding: 20 }]}>
        <Text style={{ color: c.danger, marginBottom: 12 }}>{err}</Text>
        <Pressable onPress={() => void load()}>
          <Text style={{ color: c.primary }}>Обновить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(x) => String(x.id)}
      contentContainerStyle={styles.pad}
      style={{ flex: 1, backgroundColor: c.appBg }}
      renderItem={renderOrder}
      ListEmptyComponent={
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>
          Заказов пока нет
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  orderTitle: { fontWeight: '700', fontSize: 17 },
  lineItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 2,
  },
  reBtn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
