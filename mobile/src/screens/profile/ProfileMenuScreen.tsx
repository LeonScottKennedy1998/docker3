import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeTokens } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import type { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMenu'>;

const items = [
  { title: 'Данные профиля', screen: 'EditProfile' },
  { title: 'Оформление и каталог', screen: 'AppearanceSettings' },
  { title: 'Смена пароля', screen: 'ChangePassword' },
  { title: 'Двухфакторная аутентификация', screen: 'TwoFactor' },
  { title: 'Отзывы', screen: 'MyReviewsMain' },
  { title: 'Политика обработки персональных данных', screen: 'PrivacyPolicy' },
] as const;

type MenuScreen = (typeof items)[number]['screen'];

function openProfileSection(navigation: Props['navigation'], screen: MenuScreen) {
  switch (screen) {
    case 'EditProfile':
      navigation.navigate('EditProfile');
      return;
    case 'AppearanceSettings':
      navigation.navigate('AppearanceSettings');
      return;
    case 'ChangePassword':
      navigation.navigate('ChangePassword');
      return;
    case 'TwoFactor':
      navigation.navigate('TwoFactor');
      return;
    case 'MyReviewsMain':
      navigation.navigate('MyReviewsMain');
      return;
    case 'PrivacyPolicy':
      navigation.navigate('PrivacyPolicy');
      return;
  }
}

export function ProfileMenuScreen({ navigation }: Props) {
  const { c } = useThemeTokens();
  const { user, logout } = useAuth();
  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email
    : '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.appBg }} contentContainerStyle={styles.pad}>
      <Text style={[styles.h1, { color: c.heading }]}>{name}</Text>
      <Text style={[styles.sub, { color: c.muted }]}>{user?.email}</Text>

      {items.map((it) => (
        <Pressable
          key={it.screen}
          onPress={() => openProfileSection(navigation, it.screen)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={{ color: c.text, fontSize: 16 }}>{it.title}</Text>
          <Text style={{ color: c.muted }}>›</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => void logout()}
        style={[styles.row, { backgroundColor: c.card, borderColor: c.danger, marginTop: 16 }]}
      >
        <Text style={{ color: c.danger, fontSize: 16, fontWeight: '700' }}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
});
