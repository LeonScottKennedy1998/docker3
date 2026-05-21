import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { urls } from '../../config/urls';
import { apiFetch, parseJsonSafe } from '../../api/client';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export function AppearanceScreen() {
  const { c } = useThemeTokens();
  const { token, user, refreshProfile, updateLocalUser } = useAuth();
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>(
    user?.theme === 'dark' ? 'dark' : 'light'
  );
  const [pageSize, setPageSize] = useState<number>(
    [10, 15, 20].includes(Number(user?.catalog_page_size))
      ? Number(user?.catalog_page_size)
      : 15
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (user?.theme === 'dark') setThemeChoice('dark');
    else setThemeChoice('light');
    const ps = user?.catalog_page_size;
    if ([10, 15, 20].includes(Number(ps))) setPageSize(Number(ps));
  }, [user?.theme, user?.catalog_page_size]);

  const savePartial = async (payload: { theme?: string; catalog_page_size?: number }) => {
    if (!token) return;
    setErr('');
    setOk('');
    setLoading(true);
    try {
      const res = await apiFetch(urls.auth.preferences, {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
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
      if (payload.theme === 'light' || payload.theme === 'dark') {
        await updateLocalUser({ theme: payload.theme });
      }
      if (payload.catalog_page_size != null) {
        await updateLocalUser({ catalog_page_size: payload.catalog_page_size });
      }
      await refreshProfile();
    } catch {
      setErr('Сеть недоступна');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      <Text style={[styles.h, { color: c.heading }]}>Тема</Text>
      <View style={styles.row}>
        {(['light', 'dark'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setThemeChoice(t);
              void savePartial({ theme: t });
            }}
            style={[
              styles.chip,
              {
                borderColor: c.border,
                backgroundColor: themeChoice === t ? c.primary : c.card,
              },
            ]}
          >
            <Text style={{ color: themeChoice === t ? '#fff' : c.text }}>
              {t === 'light' ? 'Светлая' : 'Тёмная'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.h, { color: c.heading, marginTop: 24 }]}>Товаров на странице каталога</Text>
      <View style={styles.row}>
        {[10, 15, 20].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              setPageSize(n);
              void savePartial({ catalog_page_size: n });
            }}
            style={[
              styles.chip,
              {
                borderColor: c.border,
                backgroundColor: pageSize === n ? c.accent : c.card,
              },
            ]}
          >
            <Text style={{ color: pageSize === n ? '#1a1a1a' : c.text }}>{n}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Text style={{ color: c.muted, marginTop: 12 }}>Сохранение…</Text> : null}
      {err ? <Text style={{ color: c.danger, marginTop: 12 }}>{err}</Text> : null}
      {ok ? <Text style={{ color: c.success, marginTop: 12 }}>{ok}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40 },
  h: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
});
