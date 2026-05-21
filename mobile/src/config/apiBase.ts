import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  apiBaseUrl?: string;
  privacyUrl?: string;
  manualUrl?: string;
};

function readExtra(): Extra {
  const e = Constants.expoConfig?.extra as Extra | undefined;
  return e ?? {};
}

function remapLocalhostForAndroid(url: string): string {
  if (Platform.OS !== 'android') return url;
  return url
    .replace(/localhost/gi, '10.0.2.2')
    .replace(/127\.0\.0\.1/g, '10.0.2.2');
}

export function getApiBaseUrl(): string {
  const fromPublic =
    typeof process.env.EXPO_PUBLIC_API_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_URL.trim()
      : '';
  const fromExtra = readExtra().apiBaseUrl?.trim() ?? '';
  let base =
    (fromPublic && fromPublic.length > 0 ? fromPublic : null) ||
    (fromExtra && fromExtra.length > 0 ? fromExtra : null) ||
    'http://localhost:5001/api';
  base = base.replace(/\/+$/, '');
  if (__DEV__ && Platform.OS === 'android') {
    base = remapLocalhostForAndroid(base);
  }
  return base;
}

export function getPrivacyUrl(): string {
  return readExtra().privacyUrl?.trim() || 'about:blank';
}

export function getManualUrl(): string {
  return readExtra().manualUrl?.trim() || 'about:blank';
}
