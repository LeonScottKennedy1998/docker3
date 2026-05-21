import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import type { Product } from '../../types/models';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { CatalogStackParamList } from '../../navigation/types';
import { formatRub, toFiniteNumber } from '../../utils/money';
import { Stars } from '../../components/Stars';

type Props = NativeStackScreenProps<CatalogStackParamList, 'CatalogList'>;

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

function sortProducts(list: Product[], key: SortKey): Product[] {
  const arr = [...list];
  switch (key) {
    case 'price-asc':
      return arr.sort((a, b) => toFiniteNumber(a.price) - toFiniteNumber(b.price));
    case 'price-desc':
      return arr.sort((a, b) => toFiniteNumber(b.price) - toFiniteNumber(a.price));
    case 'name-asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    case 'name-desc':
      return arr.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
    case 'newest':
    default:
      return arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
  }
}

function uniqueCategories(products: Product[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => {
    if (p.category) set.add(p.category);
  });
  return ['all', ...[...set].sort((a, b) => a.localeCompare(b, 'ru'))];
}

export function CatalogScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { user, token } = useAuth();
  const pageSize = [10, 15, 20].includes(Number(user?.catalog_page_size))
    ? Number(user?.catalog_page_size)
    : 15;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [wishIds, setWishIds] = useState<Set<number>>(new Set());
  const [wishBusyId, setWishBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(urls.products.list, { method: 'GET' });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка загрузки';
        throw new Error(msg);
      }
      if (!Array.isArray(data)) {
        setProducts([]);
        return;
      }
      setProducts(data as Product[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Сеть недоступна');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWishlistIds = useCallback(async () => {
    if (!token) {
      setWishIds(new Set());
      return;
    }
    try {
      const res = await apiFetch(urls.wishlist.base, { method: 'GET', token });
      const data = await parseJsonSafe(res);
      if (!res.ok || !Array.isArray(data)) return;
      const ids = new Set<number>();
      (data as { product_id: number }[]).forEach((row) => ids.add(row.product_id));
      setWishIds(ids);
    } catch {
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadWishlistIds();
    }, [load, loadWishlistIds])
  );

  const categories = useMemo(() => uniqueCategories(products), [products]);

  const filteredSorted = useMemo(() => {
    let list = [...products];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      });
    }
    if (category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    return sortProducts(list, sortBy);
  }, [products, category, sortBy, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * pageSize;
  const pageSlice = filteredSorted.slice(sliceStart, sliceStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [category, sortBy, pageSize, search]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const toggleWishlist = async (productId: number) => {
    if (!token) return;
    if (wishBusyId !== null) return;
    setWishBusyId(productId);
    try {
      const isIn = wishIds.has(productId);
      const res = isIn
        ? await apiFetch(urls.wishlist.remove(productId), { method: 'DELETE', token })
        : await apiFetch(urls.wishlist.base, {
            method: 'POST',
            body: JSON.stringify({ productId }),
            token,
          });
      if (res.ok) {
        setWishIds((prev) => {
          const next = new Set(prev);
          if (isIn) next.delete(productId);
          else next.add(productId);
          return next;
        });
      }
    } catch {
    } finally {
      setWishBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const display =
      item.has_discount && item.final_price != null
        ? toFiniteNumber(item.final_price)
        : toFiniteNumber(item.price);
    const old = item.has_discount
      ? toFiniteNumber(item.original_price ?? item.price)
      : undefined;
    const avg = toFiniteNumber(item.avg_rating);
    const count = Math.round(toFiniteNumber(item.reviews_count, 0));
    const inWish = wishIds.has(item.id);
    const outOfStock = (item.stock ?? 0) <= 0;
    return (
      <Pressable
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: outOfStock ? c.danger : c.border,
            opacity: pressed ? 0.92 : outOfStock ? 0.88 : 1,
          },
        ]}
      >
        <View style={styles.imgWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={[styles.img, styles.ph, { backgroundColor: c.surface }]}>
              <Text style={{ color: c.muted, fontSize: 12 }}>Нет фото</Text>
            </View>
          )}
          {outOfStock ? (
            <View style={[styles.soldOutBadge, { backgroundColor: 'rgba(231,76,60,0.92)' }]}>
              <Text style={styles.soldOutText}>Нет в наличии</Text>
            </View>
          ) : null}
          {token ? (
            <Pressable
              accessibilityLabel={inWish ? 'Убрать из избранного' : 'В избранное'}
              onPress={() => void toggleWishlist(item.id)}
              disabled={wishBusyId === item.id}
              style={[
                styles.heartBtn,
                { backgroundColor: inWish ? 'rgba(220,50,50,0.92)' : 'rgba(0,0,0,0.35)' },
              ]}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{inWish ? '♥' : '♡'}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.cat, { color: c.muted }]} numberOfLines={1}>
            {item.category}
          </Text>
          <View style={styles.ratingRow}>
            <Stars value={avg} size={11} />
            {avg > 0 ? (
              <Text style={{ color: c.muted, fontSize: 11, marginLeft: 4 }}>{avg.toFixed(1)}</Text>
            ) : null}
            <Text style={{ color: c.muted, fontSize: 11, marginLeft: 4 }}>({count})</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.price }]}>{formatRub(display)}</Text>
            {item.has_discount && old != null ? (
              <Text style={[styles.oldPrice, { color: c.muted }]}>{formatRub(old)}</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg, padding: 24 }]}>
        <Text style={{ color: c.danger, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
        <Pressable onPress={() => void load()} style={[styles.retry, { borderColor: c.primary }]}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const sortLabel: Record<SortKey, string> = {
    newest: 'Сначала новые',
    'price-asc': 'Цена ↑',
    'price-desc': 'Цена ↓',
    'name-asc': 'Название А→Я',
    'name-desc': 'Название Я→А',
  };

  const sortKeys: SortKey[] = ['newest', 'price-asc', 'price-desc', 'name-asc', 'name-desc'];

  const listHeader = (
    <>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>Поиск</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Название или категория"
          placeholderTextColor={c.muted}
          style={[
            styles.search,
            { color: c.text, borderColor: c.border, backgroundColor: c.card },
          ]}
        />
      </View>
      <View style={[styles.chipsWrap, { borderBottomColor: c.border }]}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(x) => x}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item: cat }) => {
            const active = category === cat;
            return (
              <Pressable
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primary : c.card,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={{ color: active ? '#fff' : c.text, fontSize: 13 }}>
                  {cat === 'all' ? 'Все' : cat}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
      <View style={[styles.sortBar, { backgroundColor: c.surface }]}>
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>Сортировка</Text>
        <FlatList
          horizontal
          data={sortKeys}
          keyExtractor={(x) => x}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          renderItem={({ item: key }) => {
            const active = sortBy === key;
            return (
              <Pressable
                onPress={() => setSortBy(key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.accent : c.card,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={{ color: active ? '#1a1a1a' : c.text, fontSize: 12 }}>
                  {sortLabel[key]}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.appBg }}>
      <FlatList
        data={pageSlice}
        keyExtractor={(x) => String(x.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 10 }}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%' }}>{renderItem({ item })}</View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: c.muted, marginTop: 24 }}>
            Нет товаров по фильтру
          </Text>
        }
        ListFooterComponent={
          filteredSorted.length > pageSize ? (
            <View style={styles.pager}>
              <Pressable
                disabled={safePage <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[styles.pageBtn, { borderColor: c.border, opacity: safePage <= 1 ? 0.4 : 1 }]}
              >
                <Text style={{ color: c.text }}>←</Text>
              </Pressable>
              <Text style={{ color: c.muted }}>
                {safePage} / {totalPages}
              </Text>
              <Pressable
                disabled={safePage >= totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={[
                  styles.pageBtn,
                  { borderColor: c.border, opacity: safePage >= totalPages ? 0.4 : 1 },
                ]}
              >
                <Text style={{ color: c.text }}>→</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipsWrap: { borderBottomWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  sortBar: { paddingHorizontal: 12, paddingTop: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  imgWrap: { position: 'relative' },
  soldOutBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    alignItems: 'center',
  },
  soldOutText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  img: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  ph: { alignItems: 'center', justifyContent: 'center' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 10 },
  title: { fontSize: 14, fontWeight: '600', minHeight: 36 },
  cat: { fontSize: 12, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 16, fontWeight: '700' },
  oldPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },
  pageBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
