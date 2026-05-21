import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { Stars } from '../../components/Stars';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ReviewEditor'>;

export function ReviewEditorScreen({ navigation, route }: Props) {
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const [rating, setRating] = useState<number>(() =>
    route.params.mode === 'edit'
      ? Math.max(1, Math.min(5, Math.round(Number(route.params.rating))))
      : 5
  );
  const [comment, setComment] = useState(
    route.params.mode === 'edit' ? route.params.comment : ''
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const title =
    route.params.mode === 'create'
      ? `Отзыв: ${route.params.productName}`
      : `Изменить: ${route.params.productName}`;

  const submit = async () => {
    if (!token) return;
    setErr('');
    const r = rating;
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      setErr('Оценка от 1 до 5');
      return;
    }
    setLoading(true);
    try {
      if (route.params.mode === 'create') {
        const res = await apiFetch(urls.reviews.create(route.params.productId), {
          method: 'POST',
          token,
          body: JSON.stringify({
            rating: r,
            comment: comment.trim() || null,
            preorder_id: route.params.preorderId,
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'error' in data
              ? String((data as { error: string }).error)
              : 'Ошибка';
          setErr(msg);
          return;
        }
      } else {
        const trimmed = comment.trim();
        const res = await apiFetch(urls.reviews.update(route.params.reviewId), {
          method: 'PUT',
          token,
          body: JSON.stringify({ rating: r, comment: trimmed.length > 0 ? trimmed : null }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'error' in data
              ? String((data as { error: string }).error)
              : 'Ошибка';
          setErr(msg);
          return;
        }
      }
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MyReviewsMain');
    } catch {
      setErr('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.appBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={[styles.head, { color: c.text }]}>{title}</Text>
        <Text style={[styles.label, { color: c.muted }]}>Оценка</Text>
        <Stars value={rating} onChange={setRating} size={28} />
        <Field
          label="Комментарий"
          placeholder="Текст отзыва (необязательно)"
          multiline
          blurOnSubmit={false}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
          value={comment}
          onChangeText={setComment}
        />
        {err ? <Text style={{ color: c.danger, marginBottom: 10 }}>{err}</Text> : null}
        <PrimaryButton title="Сохранить" loading={loading} onPress={() => void submit()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  head: { fontSize: 16, marginBottom: 16, fontWeight: '600' },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '500' },
});
