import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, Alert, Platform } from 'react-native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';

export function TwoFactorScreen() {
  const { c } = useThemeTokens();
  const { token, user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(urls.auth.twoFactorStatus, { method: 'GET', token });
      const data = await parseJsonSafe(res);
      if (res.ok && data && typeof data === 'object' && 'two_factor_enabled' in data) {
        setEnabled(Boolean((data as { two_factor_enabled: boolean }).two_factor_enabled));
      }
    } catch {
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startEnable = async () => {
    if (!token) return;
    setErr('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.twoFactorEnable, { method: 'POST', token });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка';
        setErr(msg);
        return;
      }
      setPending(true);
      setInfo('Код отправлен на почту. Введите его ниже.');
    } catch {
      setErr('Сеть');
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!token) return;
    setErr('');
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.twoFactorVerify, {
        method: 'POST',
        token,
        body: JSON.stringify({ code: code.trim() }),
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
      setEnabled(true);
      setPending(false);
      setCode('');
      setInfo('2FA включена.');
    } catch {
      setErr('Сеть');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setErr('');
    try {
      const body =
        user?.id != null
          ? { userId: user.id }
          : user?.email
            ? { email: user.email }
            : {};
      const res = await apiFetch(urls.auth.twoFactorResend, {
        method: 'POST',
        headers: {},
        body: JSON.stringify(body),
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
      setInfo('Код отправлен повторно.');
    } catch {
      setErr('Сеть');
    }
  };

  const disable = () => {
    if (Platform.OS === 'web') {
      const ok =
        typeof globalThis.confirm === 'function' &&
        globalThis.confirm(
          'Отключить двухфакторную вход? Вход станет только по паролю.'
        );
      if (ok) void doDisable();
      return;
    }
    Alert.alert('Отключить 2FA?', 'Вход станет только по паролю.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отключить',
        style: 'destructive',
        onPress: () => void doDisable(),
      },
    ]);
  };

  const doDisable = async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch(urls.auth.twoFactorDisable, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
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
      setEnabled(false);
      setPending(false);
      setInfo('2FA отключена.');
    } catch {
      setErr('Сеть');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      <Text style={{ color: c.text, marginBottom: 12 }}>
        Статус: {enabled ? 'включена' : pending ? 'ожидает подтверждения кода' : 'выключена'}
      </Text>
      {!enabled && !pending ? (
        <PrimaryButton title="Включить 2FA" loading={loading} onPress={() => void startEnable()} />
      ) : null}
      {pending ? (
        <>
          <Field label="Код из письма" keyboardType="number-pad" value={code} onChangeText={setCode} />
          <PrimaryButton title="Подтвердить" loading={loading} onPress={() => void verify()} />
          <PrimaryButton title="Отправить код снова" variant="outline" onPress={() => void resend()} style={{ marginTop: 10 }} />
        </>
      ) : null}
      {enabled ? (
        <PrimaryButton title="Отключить 2FA" variant="danger" loading={loading} onPress={disable} />
      ) : null}
      {info ? <Text style={{ color: c.success, marginTop: 12 }}>{info}</Text> : null}
      {err ? <Text style={{ color: c.danger, marginTop: 12 }}>{err}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
});
