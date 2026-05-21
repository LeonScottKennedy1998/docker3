import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import type { AuthStackParamList } from '../../navigation/types';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';
import { validateEmail } from '../../utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setMsg('');
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErr(emailErr);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.forgotPassword, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const e =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: string }).error)
            : 'Ошибка';
        setErr(e);
        return;
      }
      setMsg(
        'Если указанный email есть в системе, на почту уйдёт письмо со ссылкой для сброса пароля. Откройте ссылку в браузере на компьютере или телефоне и задайте новый пароль, затем войдите здесь.'
      );
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
        <Pressable style={{ alignSelf: 'flex-start', marginBottom: 8 }} onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: c.primary }}>← ко входу</Text>
        </Pressable>
        <Field
          label="Email учётной записи"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
        {msg ? <Text style={{ color: c.text, marginBottom: 16 }}>{msg}</Text> : null}
        <PrimaryButton title="Отправить письмо" loading={loading} onPress={() => void submit()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
});
