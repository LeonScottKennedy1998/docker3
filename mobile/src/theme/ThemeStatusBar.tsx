import { StatusBar } from 'expo-status-bar';
import { useThemeTokens } from '../context/ThemeContext';

export function ThemeStatusBar() {
  const { scheme } = useThemeTokens();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
