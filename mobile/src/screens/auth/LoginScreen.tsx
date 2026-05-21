import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';
import { validateDigitCode, validateEmail } from '../../utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const TWO_FA_DIGITS = 6;

export function LoginScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { loginStep1, loginWith2FA } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step2, setStep2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onLogin = async () => {
    setErr('');
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErr(emailErr);
      return;
    }
    if (!password) {
      setErr('Укажите пароль');
      return;
    }
    setLoading(true);
    try {
      const res = await loginStep1(email.trim(), password);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      if (res.requiresTwoFactor) {
        setStep2(true);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const on2fa = async () => {
    setErr('');
    const codeErr = validateDigitCode(code, TWO_FA_DIGITS, 'Код 2FA');
    if (codeErr) {
      setErr(codeErr);
      return;
    }
    setLoading(true);
    try {
      const digits = code.trim().replace(/\D/g, '');
      const res = await loginWith2FA(email.trim(), password, digits);
      if (!res.ok) {
        setErr(res.error ?? 'Ошибка');
        return;
      }
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
        <Text style={[styles.h1, { color: c.heading }]}>Вход</Text>
        <Text style={[styles.sub, { color: c.muted }]}>
          Вход для зарегистрированных клиентов. Новая учётная запись оформляется на сайте магазина.
        </Text>

        {!step2 ? (
          <>
            <Field
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              label="Пароль"
              secureTextEntry
              revealPassword
              value={password}
              onChangeText={setPassword}
            />
            {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
            <PrimaryButton title="Войти" loading={loading} onPress={() => void onLogin()} />
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
              <Text style={{ color: c.muted }}>Забыли пароль?</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: c.text, marginBottom: 12 }}>
              Введите код из письма для {email}
            </Text>
            <Field label="Код 2FA (6 цифр)" keyboardType="number-pad" value={code} onChangeText={setCode} />
            {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
            <PrimaryButton title="Подтвердить" loading={loading} onPress={() => void on2fa()} />
            <PrimaryButton
              title="Назад"
              variant="outline"
              onPress={() => {
                setStep2(false);
                setCode('');
                setErr('');
              }}
              style={{ marginTop: 10 }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 14, marginBottom: 18, lineHeight: 20 },
  link: { marginTop: 14, alignItems: 'center' },
});
