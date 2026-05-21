import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import type { ReviewableRow } from '../../types/models';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Stars } from '../../components/Stars';
import type { ProfileStackParamList } from '../../navigation/types';
import { toFiniteNumber } from '../../utils/money';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyReviewsMain'>;

interface MyReviewRow {
  review_id: number;
  rating: number;
  comment: string | null;
  preorder_id?: number;
  created_at?: string;
  product_id: number;
  product_name?: string;
}

type Segment = 'pending' | 'mine';
type DateSort = 'newest' | 'oldest';

function sortTs(a: string | undefined, b: string | undefined, order: DateSort): number {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return order === 'newest' ? tb - ta : ta - tb;
}

export function MyReviewsScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const [segment, setSegment] = useState<Segment>('pending');
  const [pendingSort, setPendingSort] = useState<DateSort>('newest');
  const [mineSort, setMineSort] = useState<DateSort>('newest');
  const [reviewable, setReviewable] = useState<ReviewableRow[]>([]);
  const [mine, setMine] = useState<MyReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const [rAvail, rMy] = await Promise.all([
        apiFetch(urls.reviews.reviewable, { method: 'GET', token }),
        apiFetch(urls.reviews.my, { method: 'GET', token }),
      ]);
      const aData = await parseJsonSafe(rAvail);
      const mData = await parseJsonSafe(rMy);
      if (!rAvail.ok) {
        const msg =
          typeof aData === 'object' && aData && 'error' in aData
            ? String((aData as { error: string }).error)
            : 'Ошибка «доступно для отзыва»';
        setErr(msg);
      } else {
        setErr('');
        setReviewable(Array.isArray(aData) ? (aData as ReviewableRow[]) : []);
      }
      if (rMy.ok) {
        setMine(Array.isArray(mData) ? (mData as MyReviewRow[]) : []);
      }
    } catch {
      setErr('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), 22000);
      return () => clearInterval(id);
    }, [load])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const pending = [...reviewable.filter((x) => !x.has_reviewed)].sort((a, b) =>
    sortTs(a.order_date, b.order_date, pendingSort)
  );

  const sortedMine = [...mine].sort((a, b) => sortTs(a.created_at, b.created_at, mineSort));

  const runDelete = async (reviewId: number) => {
    if (!token) return;
    try {
      const res = await apiFetch(urls.reviews.delete(reviewId), {
        method: 'DELETE',
        token,
      });
      if (res.ok) void load();
    } catch {
    }
  };

  const removeReview = (reviewId: number) => {
    if (Platform.OS === 'web') {
      const ok =
        typeof globalThis.confirm === 'function' &&
        globalThis.confirm('Удалить отзыв безвозвратно?');
      if (ok) void runDelete(reviewId);
      return;
    }
    Alert.alert('Удалить отзыв?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void runDelete(reviewId),
      },
    ]);
  };

  if (loading && reviewable.length === 0 && mine.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: c.appBg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.appBg }}
      contentContainerStyle={styles.pad}
      keyboardShouldPersistTaps="handled"
    >
      {err ? <Text style={{ color: c.danger, marginBottom: 12 }}>{err}</Text> : null}

      <Text style={[styles.segWrapLabel, { color: c.muted }]}>Раздел</Text>
      <View style={[styles.segment, { borderColor: c.border }]}>
        <Pressable
          onPress={() => setSegment('pending')}
          style={[styles.segBtn, segment === 'pending' && { backgroundColor: c.primary }]}
        >
          <Text
            style={{ color: segment === 'pending' ? '#fff' : c.text, fontWeight: '600', textAlign: 'center' }}
          >
            Ждут отзыва
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSegment('mine')}
          style={[styles.segBtn, segment === 'mine' && { backgroundColor: c.primary }]}
        >
          <Text
            style={{ color: segment === 'mine' ? '#fff' : c.text, fontWeight: '600', textAlign: 'center' }}
          >
            Мои отзывы
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.segWrapLabel, { color: c.muted, marginTop: 14 }]}>Порядок дат</Text>
      <View style={styles.sortRow}>
        {(segment === 'pending' ? ['newest', 'oldest'] : ['newest', 'oldest']).map((k) => {
          const active =
            segment === 'pending'
              ? pendingSort === k
              : mineSort === k;
          return (
            <Pressable
              key={k}
              onPress={() => {
                if (segment === 'pending') setPendingSort(k as DateSort);
                else setMineSort(k as DateSort);
              }}
              style={[
                styles.sortChip,
                {
                  borderColor: c.border,
                  backgroundColor: active ? c.accent : c.card,
                },
              ]}
            >
              <Text style={{ color: active ? '#1a1a1a' : c.text, fontSize: 13 }}>
                {k === 'newest' ? 'Сначала новые' : 'Сначала старые'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => void load()}
        style={{ alignSelf: 'flex-start', marginTop: 8, marginBottom: 8 }}
      >
        <Text style={{ color: c.primary, fontWeight: '600' }}>Обновить сейчас</Text>
      </Pressable>

      {segment === 'pending' ? (
        <>
          {pending.length === 0 ? (
            <Text style={{ color: c.muted, marginBottom: 20 }}>
              Нет товаров из выданных заказов без отзыва
            </Text>
          ) : (
            pending.map((row) => (
              <View
                key={`${row.id}-${row.order_id}`}
                style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{row.name}</Text>
                <Text style={{ color: c.muted, marginTop: 6, fontSize: 13 }}>
                  Заказ от {new Date(row.order_date).toLocaleDateString('ru-RU')}
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate('ReviewEditor', {
                      mode: 'create',
                      productId: row.id,
                      preorderId: row.order_id,
                      productName: row.name,
                    })
                  }
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Оставить отзыв</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          {sortedMine.length === 0 ? (
            <Text style={{ color: c.muted }}>Вы ещё не оставляли отзывов или список пуст.</Text>
          ) : (
            sortedMine.map((r) => (
              <View
                key={r.review_id}
                style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{r.product_name ?? 'Товар'}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                  {r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : ''}
                </Text>
                <Stars value={toFiniteNumber(r.rating)} size={14} />
                {r.comment ? (
                  <Text style={{ color: c.text, marginTop: 8 }}>{r.comment}</Text>
                ) : (
                  <Text style={{ color: c.muted, marginTop: 8, fontStyle: 'italic' }}>Без текста</Text>
                )}
                <View style={styles.actRow}>
                  <Pressable
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() =>
                      navigation.navigate('ReviewEditor', {
                        mode: 'edit',
                        reviewId: r.review_id,
                        productId: r.product_id,
                        productName: r.product_name ?? 'Товар',
                        rating: toFiniteNumber(r.rating),
                        comment: r.comment ?? '',
                      })
                    }
                  >
                    <Text style={{ color: c.primary, fontWeight: '600' }}>Редактировать</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={{ top: 12, bottom: 12, left: 16, right: 12 }}
                    onPress={() => removeReview(r.review_id)}
                    style={{ marginLeft: 16, paddingVertical: 4 }}
                  >
                    <Text style={{ color: c.danger, fontWeight: '600' }}>Удалить</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 16, paddingBottom: 40 },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  segWrapLabel: { fontSize: 12, marginBottom: 6 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  actRow: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    zIndex: 2,
  },
});
