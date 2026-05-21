import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CatalogStackParamList } from './types';
import { CatalogScreen } from '../screens/catalog/CatalogScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import { ProductReviewsScreen } from '../screens/reviews/ProductReviewsScreen';

const Stack = createNativeStackNavigator<CatalogStackParamList>();

export function CatalogStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Назад',
      }}
    >
      <Stack.Screen name="CatalogList" component={CatalogScreen} options={{ title: 'Каталог' }} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Товар' }}
      />
      <Stack.Screen
        name="ProductReviews"
        component={ProductReviewsScreen}
        options={{ title: 'Отзывы' }}
      />
    </Stack.Navigator>
  );
}
