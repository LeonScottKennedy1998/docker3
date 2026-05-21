import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useThemeTokens } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { CatalogStack } from './CatalogStack';
import { CartScreen } from '../screens/cart/CartScreen';
import { ProfileStack } from './ProfileStack';
import { WishlistScreen } from '../screens/wishlist/WishlistScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function tabIcon(symbol: string) {
  return function Icon({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 20 }}>{symbol}</Text>;
  };
}

export function MainTabs() {
  const { c } = useThemeTokens();
  const { totalQuantity } = useCart();
  const cartBadge =
    totalQuantity > 99 ? '99+' : totalQuantity > 0 ? totalQuantity : undefined;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
        },
      }}
    >
      <Tab.Screen
        name="Catalog"
        component={CatalogStack}
        options={{ title: 'Каталог', tabBarIcon: tabIcon('🛍️') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate({
              name: 'Catalog',
              params: { screen: 'CatalogList' },
              merge: true,
            });
          },
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Корзина', tabBarIcon: tabIcon('🛒'), tabBarBadge: cartBadge }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Cart');
          },
        })}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{ title: 'Избранное', tabBarIcon: tabIcon('♥️') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Wishlist');
          },
        })}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: 'Заказы', tabBarIcon: tabIcon('📦') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Orders');
          },
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Профиль', tabBarIcon: tabIcon('👤') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate({
              name: 'Profile',
              params: { screen: 'ProfileMenu' },
              merge: true,
            });
          },
        })}
      />
    </Tab.Navigator>
  );
}
