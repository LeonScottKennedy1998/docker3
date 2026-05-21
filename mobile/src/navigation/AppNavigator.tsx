import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../context/ThemeContext';
import { MainTabs } from './MainTabs';
import { AuthStack } from './AuthStack';

export function AppNavigator() {
  const { hydrated, token, user } = useAuth();
  const { scheme, c } = useThemeTokens();
  const authed = Boolean(token && user?.id);

  const navTheme =
    scheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: c.primary,
            background: c.appBg,
            card: c.card,
            text: c.text,
            border: c.border,
            notification: c.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: c.primary,
            background: c.appBg,
            card: c.card,
            text: c.text,
            border: c.border,
            notification: c.primary,
          },
        };

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.appBg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {authed ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
