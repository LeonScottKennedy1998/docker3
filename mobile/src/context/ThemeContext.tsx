import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { colors, type ColorScheme } from '../theme/colors';
import { useAuth } from './AuthContext';

type Palette = (typeof colors)[ColorScheme];

type ThemeCtx = {
  scheme: ColorScheme;
  c: Palette;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  const pref = user?.theme === 'dark' ? 'dark' : user?.theme === 'light' ? 'light' : null;
  const system = Appearance.getColorScheme();

  const [scheme, setScheme] = useState<ColorScheme>(() => {
    if (pref) return pref;
    return system === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      if (!hydrated || !user) {
        setScheme(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });
    return () => sub.remove();
  }, [hydrated, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      setScheme((Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'));
      return;
    }
    setScheme(user.theme === 'dark' ? 'dark' : 'light');
  }, [hydrated, user?.theme]);

  const value = useMemo<ThemeCtx>(() => ({
    scheme,
    c: colors[scheme],
  }), [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeTokens() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeProvider отсутствует');
  return ctx;
}
