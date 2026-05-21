import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { urls } from '../config/urls';
import { ApiError, apiFetch } from '../api/client';
import { deleteAuthToken, getAuthToken, setAuthToken } from '../storage/authToken';
import type { User } from '../types/models';

const USER_KEY = 'mpt_user_json';

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
};

type LoginResult =
  | { ok: true; requiresTwoFactor: false; user: User; token: string }
  | { ok: true; requiresTwoFactor: true; email: string; userId: number | null }
  | { ok: false; error: string };

export type AuthContextValue = AuthState & {
  loginStep1: (email: string, password: string) => Promise<LoginResult>;
  loginWith2FA: (
    email: string,
    password: string,
    twoFactorCode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLocalUser: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const idRaw = u.id ?? u.user_id;
  let id: number;
  if (typeof idRaw === 'number' && Number.isFinite(idRaw)) {
    id = idRaw;
  } else if (typeof idRaw === 'string' && /^-?\d+$/.test(idRaw.trim())) {
    id = parseInt(idRaw.trim(), 10);
  } else {
    return null;
  }
  const base = raw as User;
  return { ...base, id };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    hydrated: false,
  });

  const persistSession = useCallback(async (token: string, user: User) => {
    await setAuthToken(token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user, hydrated: true });
  }, []);

  const clearSession = useCallback(async () => {
    await deleteAuthToken();
    await AsyncStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, hydrated: true });
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await apiFetch(urls.auth.profile, {
        method: 'GET',
        headers: {},
        token,
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        await clearSession();
        return;
      }
      const obj = data as Record<string, unknown>;
      const u = parseUser(obj.user);
      if (u) await persistSession(token, u);
    } catch {
      await clearSession();
    }
  }, [clearSession, persistSession]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const token = await getAuthToken();
        const storedUserRaw = await AsyncStorage.getItem(USER_KEY);
        if (!token) {
          if (!cancelled) setState({ token: null, user: null, hydrated: true });
          return;
        }
        const storedUser = storedUserRaw ? parseUser(JSON.parse(storedUserRaw)) : null;
        if (!cancelled) setState({ token, user: storedUser, hydrated: true });
        await refreshProfile();
      } catch {
        if (!cancelled) setState({ token: null, user: null, hydrated: true });
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const loginStep1 = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await apiFetch(urls.auth.login, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'Ошибка входа',
        };
      }
      if (data.requiresTwoFactor === true) {
        return {
          ok: true,
          requiresTwoFactor: true,
          email: String(data.email ?? email),
          userId:
            typeof data.userId === 'number'
              ? data.userId
              : data.userId != null
                ? Number(data.userId)
                : null,
        };
      }
      const token = String(data.token ?? '');
      const rawUser = data.user as unknown;
      const user = parseUser(rawUser);
      if (!token || !user) {
        return { ok: false, error: 'Некорректный ответ сервера' };
      }
      if (user.role !== 'Клиент') {
        return {
          ok: false,
          error: 'Клиент с такими данными не найден. Проверьте логин и пароль.',
        };
      }
      const normalized: User = {
        ...user,
        theme: user.theme === 'dark' ? 'dark' : 'light',
      };
      await persistSession(token, normalized);
      return { ok: true, requiresTwoFactor: false, user: normalized, token };
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Сеть недоступна';
      return { ok: false, error: msg };
    }
  }, [persistSession]);

  const loginWith2FA = useCallback(
    async (email: string, password: string, twoFactorCode: string) => {
      try {
        const res = await apiFetch(urls.auth.login, {
          method: 'POST',
          body: JSON.stringify({ email, password, twoFactorCode }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          return {
            ok: false,
            error: typeof data.error === 'string' ? data.error : 'Ошибка',
          };
        }
        const token = String(data.token ?? '');
        const user = parseUser(data.user as unknown);
        if (!token || !user || user.role !== 'Клиент') {
          return {
            ok: false,
            error: 'Клиент с такими данными не найден. Проверьте логин и пароль.',
          };
        }
        const normalized: User = {
          ...user,
          theme: user.theme === 'dark' ? 'dark' : 'light',
        };
        await persistSession(token, normalized);
        return { ok: true };
      } catch (e: unknown) {
        return {
          ok: false,
          error:
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Ошибка сети',
        };
      }
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    const tok = await getAuthToken();
    if (tok) {
      try {
        await apiFetch(urls.auth.logout, { method: 'POST', token: tok });
      } catch {
      }
    }
    await clearSession();
  }, [clearSession]);

  const setSession = persistSession;

  const updateLocalUser = useCallback(
    async (patch: Partial<User>) => {
      const token = await getAuthToken();
      if (!state.user || !token) return;
      const merged = { ...state.user, ...patch };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(merged));
      setState((s) => ({ ...s, user: merged }));
    },
    [state.user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      loginStep1,
      loginWith2FA,
      logout,
      setSession,
      refreshProfile,
      updateLocalUser,
    }),
    [state, loginStep1, loginWith2FA, logout, setSession, refreshProfile, updateLocalUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth без AuthProvider');
  return ctx;
}
