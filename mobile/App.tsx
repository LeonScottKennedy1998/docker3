import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { CartProvider } from './src/context/CartContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeStatusBar } from './src/theme/ThemeStatusBar';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <CartProvider>
            <ThemeStatusBar />
            <AppNavigator />
          </CartProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
