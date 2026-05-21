import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { Stars } from '../../components/Stars';
import type { CatalogStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductReviews'>;

interface ReviewRow {
  review_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

interface ProductReviewsPayload {
  reviews: ReviewRow[];
  avg_rating: number;
  total_reviews: number;
}

export function ProductReviewsScreen({ route }: Props) {
  const { productId, productName } = route.params;
  const { c } = useThemeTokens();
  const [data, setData] = useState<ProductReviewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch(urls.reviews.product(productId), { method: 'GET' });
      const raw = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          raw && typeof raw === 'object' && 'error' in raw
            ? String((raw as { error: string }).error)
            : 'Ошибка';
        setErr(msg);
        return;
      }
      const payload = raw as ProductReviewsPayload;
      setData({
        reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
        avg_rating: Number(payload.avg_rating) || 0,
        total_reviews: Number(payload.total_reviews) || 0,
      });
    } catch {
      setErr('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Text style={{ color: c.danger }}>{err}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.appBg }}>
      <View style={[styles.head, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.heading }]} numberOfLines={2}>
          {productName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Stars value={data?.avg_rating ?? 0} />
          <Text style={{ color: c.muted, marginLeft: 8 }}>
            {data?.total_reviews ?? 0} отзывов
          </Text>
        </View>
      </View>
      <FlatList
        data={data?.reviews ?? []}
        keyExtractor={(r) => String(r.review_id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <Stars value={item.rating} size={13} />
            <Text style={{ color: c.muted, marginTop: 6, marginBottom: 8 }}>
              {[item.first_name, item.last_name].filter(Boolean).join(' ').trim() || 'Клиент'}{' '}
              · {new Date(item.created_at).toLocaleDateString('ru-RU')}
            </Text>
            {item.comment ? (
              <Text style={{ color: c.text }}>{item.comment}</Text>
            ) : (
              <Text style={{ color: c.muted }}>Без комментария</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>
            Отзывов пока нет
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  head: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
});
