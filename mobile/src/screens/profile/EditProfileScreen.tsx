import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Field } from '../../ui/fields';
import { PrimaryButton } from '../../ui/buttons';

export function EditProfileScreen() {
  const { c } = useThemeTokens();
  const { token, user, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPatronymic(user.patronymic ?? '');
      setPhone(user.phone ?? '');
    }
  }, [user]);

  const save = async () => {
    if (!token) return;
    setErr('');
    setOk('');
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.updateProfile, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          patronymic: patronymic.trim() || null,
          phone: phone.trim() || null,
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
      setOk('Сохранено');
      await refreshProfile();
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
        <Field label="Имя" value={firstName} onChangeText={setFirstName} />
        <Field label="Фамилия" value={lastName} onChangeText={setLastName} />
        <Field label="Отчество" value={patronymic} onChangeText={setPatronymic} />
        <Field label="Телефон" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
        {ok ? <Text style={{ color: c.success, marginBottom: 8 }}>{ok}</Text> : null}
        <PrimaryButton title="Сохранить" loading={loading} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
});
