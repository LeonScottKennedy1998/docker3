import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileMenuScreen } from '../screens/profile/ProfileMenuScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AppearanceScreen } from '../screens/profile/AppearanceScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { TwoFactorScreen } from '../screens/profile/TwoFactorScreen';
import { OrderSuccessScreen } from '../screens/orders/OrderSuccessScreen';
import { PrivacyPolicyScreen } from '../screens/legal/PrivacyPolicyScreen';
import { MyReviewsScreen } from '../screens/reviews/MyReviewsScreen';
import { ReviewEditorScreen } from '../screens/reviews/ReviewEditorScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      initialRouteName="ProfileMenu"
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Назад',
      }}
    >
      <Stack.Screen name="ProfileMenu" component={ProfileMenuScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Политика обработки персональных данных' }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Данные профиля' }} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceScreen} options={{ title: 'Оформление' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Пароль' }} />
      <Stack.Screen name="TwoFactor" component={TwoFactorScreen} options={{ title: 'Безопасность' }} />
      <Stack.Screen name="MyReviewsMain" component={MyReviewsScreen} options={{ title: 'Мои отзывы' }} />
      <Stack.Screen name="ReviewEditor" component={ReviewEditorScreen} options={{ title: 'Отзыв' }} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ title: 'Заказ оформлен' }} />
    </Stack.Navigator>
  );
}
