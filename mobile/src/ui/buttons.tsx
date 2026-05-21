import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { useThemeTokens } from '../context/ThemeContext';

type PrimaryBtnProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: PrimaryBtnProps) {
  const { c } = useThemeTokens();
  const isDisabled = disabled || loading;
  const bg =
    variant === 'outline'
      ? 'transparent'
      : variant === 'danger'
        ? c.danger
        : c.primary;
  const borderColor = variant === 'outline' ? c.border : bg;
  const textColor =
    variant === 'outline' ? c.primary : '#ffffff';

  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
        },
        variant === 'outline' && styles.outline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? c.primary : '#fff'} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  outline: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
