import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import type { Product } from '../../types/models';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { PrimaryButton } from '../../ui/buttons';
import { Stars } from '../../components/Stars';
import type { CatalogStackParamList } from '../../navigation/types';
import { formatRub, toFiniteNumber } from '../../utils/money';
type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const { add } = useCart();
  const { width: winW } = useWindowDimensions();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wishBusy, setWishBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(urls.products.byId(productId), { method: 'GET' });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Товар не найден';
        throw new Error(msg);
      }
      setProduct(data as Product);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWishlist = async () => {
    if (!product || !token) {
      return;
    }
    setWishBusy(true);
    try {
      const check = await apiFetch(urls.wishlist.check(product.id), {
        method: 'GET',
        token,
      });
      const checkData = (await parseJsonSafe(check)) as {
        isInWishlist?: boolean;
      };
      const isIn = checkData.isInWishlist === true;
      const res = isIn
        ? await apiFetch(urls.wishlist.remove(product.id), { method: 'DELETE', token })
        : await apiFetch(urls.wishlist.base, {
            method: 'POST',
            body: JSON.stringify({ productId: product.id }),
            token,
          });
      if (!res.ok) {
        const data = await parseJsonSafe(res);
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка избранного';
        throw new Error(msg);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Избранное');
    } finally {
      setWishBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg, padding: 20 }]}>
        <Text style={{ color: c.danger }}>{error || 'Не найдено'}</Text>
        <PrimaryButton title="Назад" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const display = toFiniteNumber(
    product.has_discount && product.final_price != null ? product.final_price : product.price
  );
  const imgs = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      {imgs.length > 0 ? (
        <FlatList
          data={imgs.map((uri, index) => ({ uri, index }))}
          keyExtractor={(it) => `${it.uri}_${it.index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          decelerationRate="fast"
          snapToInterval={winW}
          snapToAlignment="start"
          getItemLayout={(_, index) => ({
            length: winW,
            offset: winW * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={{ width: winW }}>
              <Image
                source={{ uri: item.uri }}
                style={{ width: winW, height: 280, backgroundColor: '#eee' }}
                resizeMode="cover"
              />
            </View>
          )}
        />
      ) : (
        <View
          style={[
            styles.ph,
            { backgroundColor: c.surface, width: winW, height: 280, alignSelf: 'center' },
          ]}
        >
          <Text style={{ color: c.muted }}>Нет фото</Text>
        </View>
      )}

      <Text style={[styles.title, { color: c.heading }]}>{product.name}</Text>
      <Text style={[styles.cat, { color: c.muted }]}>{product.category}</Text>

      <View style={styles.ratingRow}>
        <Stars value={toFiniteNumber(product.avg_rating)} />
        <Text style={{ color: c.muted, marginLeft: 8 }}>
          ({toFiniteNumber(product.reviews_count, 0)})
        </Text>
        <Pressable onPress={() => navigation.navigate('ProductReviews', { productId: product.id, productName: product.name })}>
          <Text style={{ color: c.primary, marginLeft: 8 }}>Отзывы</Text>
        </Pressable>
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: c.price }]}>{formatRub(display)}</Text>
        {product.has_discount && product.original_price != null ? (
          <Text style={[styles.old, { color: c.muted }]}>{formatRub(product.original_price)}</Text>
        ) : null}
      </View>

      <Text style={[styles.desc, { color: c.text }]}>{product.description}</Text>

      {product.extra_info && Object.keys(product.extra_info).length > 0 ? (
        <View style={[styles.extra, { borderColor: c.border, backgroundColor: c.card }]}>
          {Object.entries(product.extra_info).map(([k, v]) => (
            <Text key={k} style={{ color: c.text, marginBottom: 6 }}>
              <Text style={{ color: c.muted }}>{k}: </Text>
              {v}
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.stockBox,
          {
            backgroundColor: c.card,
            borderColor: product.stock <= 0 ? c.danger : c.border,
            marginHorizontal: 16,
            marginTop: 8,
          },
        ]}
      >
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>
          {product.stock <= 0 ? (
            <Text style={{ color: c.danger, fontWeight: '600' }}>Товар закончился</Text>
          ) : (
            <>
              На складе: <Text style={{ fontWeight: '700' }}>{product.stock}</Text> шт.
            </>
          )}
        </Text>
      </View>

      <PrimaryButton
        title={product.stock <= 0 ? 'Нет в наличии' : 'В корзину'}
        disabled={product.stock <= 0}
        onPress={() => {
          if (product.stock <= 0) return;
          add(
            {
              productId: product.id,
              name: product.name,
              price: display,
              quantity: 1,
              image_url: product.image_url ?? product.images?.[0],
            },
            true
          );
        }}
        style={{ marginBottom: 10 }}
      />
      <PrimaryButton
        title={wishBusy ? '…' : 'Избранное'}
        variant="outline"
        loading={wishBusy}
        onPress={() => void toggleWishlist()}
        style={{ marginBottom: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { paddingBottom: 32 },
  ph: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginTop: 16, paddingHorizontal: 16 },
  cat: { fontSize: 14, paddingHorizontal: 16, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  price: { fontSize: 24, fontWeight: '800' },
  old: { fontSize: 16, textDecorationLine: 'line-through' },
  desc: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, marginTop: 16 },
  extra: { marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
  stockBox: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
});
