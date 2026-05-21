import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useThemeTokens } from '../../context/ThemeContext';
import type { MainTabParamList, ProfileStackParamList } from '../../navigation/types';
import { PrimaryButton } from '../../ui/buttons';

type Props = NativeStackScreenProps<ProfileStackParamList, 'OrderSuccess'>;

export function OrderSuccessScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { c } = useThemeTokens();

  const tabNav = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const goOrders = () => {
    tabNav?.navigate('Orders');
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.appBg }]}>
      <Text style={[styles.title, { color: c.heading }]}>Спасибо за заказ</Text>
      <Text style={{ color: c.text, marginBottom: 8 }}>Номер заказа: {orderId}</Text>
      <Text style={{ color: c.muted, marginBottom: 24 }}>
        Статус и состав заказов смотрите во вкладке «Заказы».
      </Text>
      <PrimaryButton title="Мои заказы" onPress={goOrders} />
      <PrimaryButton
        title="В каталог"
        variant="outline"
        style={{ marginTop: 12 }}
        onPress={() => {
          tabNav?.navigate('Catalog', { screen: 'CatalogList' });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
});
