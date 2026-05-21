import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';

export function ChangePasswordScreen() {
  const { c } = useThemeTokens();
  const { token } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const save = async () => {
    if (!token) return;
    setErr('');
    setOk('');
    if (next !== next2) {
      setErr('Новые пароли не совпадают');
      return;
    }
    if (next.length < 6) {
      setErr('Не короче 6 символов');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.changePassword, {
        method: 'PUT',
        token,
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
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
      setOk('Пароль изменён');
      setCur('');
      setNext('');
      setNext2('');
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
        <Field
          label="Текущий пароль"
          secureTextEntry
          revealPassword
          value={cur}
          onChangeText={setCur}
        />
        <Field
          label="Новый пароль"
          secureTextEntry
          revealPassword
          value={next}
          onChangeText={setNext}
        />
        <Field label="Повтор нового" secureTextEntry revealPassword value={next2} onChangeText={setNext2} />
        {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
        {ok ? <Text style={{ color: c.success, marginBottom: 8 }}>{ok}</Text> : null}
        <PrimaryButton title="Сменить пароль" loading={loading} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
});
