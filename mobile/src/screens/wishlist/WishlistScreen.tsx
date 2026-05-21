import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { wishlistRowToProduct, type WishlistRowApi } from '../../api/types';
import type { Product } from '../../types/models';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { MainTabParamList } from '../../navigation/types';
import { formatRub, toFiniteNumber } from '../../utils/money';

type Props = BottomTabScreenProps<MainTabParamList, 'Wishlist'>;

export function WishlistScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const [rows, setRows] = useState<WishlistRowApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch(urls.wishlist.base, { method: 'GET', token });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка';
        setErr(msg);
        return;
      }
      if (!Array.isArray(data)) setRows([]);
      else setRows(data as WishlistRowApi[]);
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

  const openProduct = (p: Product) => {
    navigation.navigate('Catalog', {
      screen: 'ProductDetail',
      params: { productId: p.id },
    });
  };

  const remove = async (productId: number) => {
    if (!token) return;
    try {
      const res = await apiFetch(urls.wishlist.remove(productId), { method: 'DELETE', token });
      if (res.ok) setRows((prev) => prev.filter((r) => r.product_id !== productId));
    } catch {
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.product_id)}
      style={{ flex: 1, backgroundColor: c.appBg }}
      contentContainerStyle={styles.pad}
      ListEmptyComponent={
        err ? (
          <Text style={{ color: c.danger }}>{err}</Text>
        ) : (
          <Text style={{ color: c.muted, textAlign: 'center' }}>Список пуст</Text>
        )
      }
      renderItem={({ item }) => {
        const p = wishlistRowToProduct(item);
        const priceRaw =
          p.has_discount && p.final_price != null ? p.final_price : p.price;
        const price = toFiniteNumber(priceRaw);
        return (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.row}>
              <Pressable
                onPress={() => openProduct(p)}
                style={({ pressed }) => [
                  styles.mainTap,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: c.surface }]} />
                )}
                <View style={styles.textCol}>
                  <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={[styles.cat, { color: c.muted }]} numberOfLines={1}>
                    {p.category}
                  </Text>
                  <Text style={[styles.price, { color: c.price }]}>{formatRub(price)}</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel="Убрать из избранного"
                hitSlop={12}
                onPress={() => void remove(p.id)}
                style={[styles.removeBtn, { borderColor: c.border }]}
              >
                <Text style={{ color: c.danger, fontSize: 18, fontWeight: '700' }}>×</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 96,
  },
  mainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 12,
  },
  thumb: { width: 88, height: 88, borderRadius: 10 },
  textCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  cat: { fontSize: 13, marginTop: 4 },
  price: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  removeBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
