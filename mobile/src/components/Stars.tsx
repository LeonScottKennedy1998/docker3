import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeTokens } from '../context/ThemeContext';

interface StarsProps {
  value: number;
  size?: number;
  onChange?: (rating: number) => void;
}

export function Stars({ value, size = 14, onChange }: StarsProps) {
  const { c } = useThemeTokens();
  const v = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(5, Math.round(v)));

  if (onChange) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={`Оценка ${n} из 5`}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={{ fontSize: size, color: n <= clamped ? c.accent : c.muted }}>★</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const full = '★'.repeat(clamped);
  const empty = '☆'.repeat(5 - clamped);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: c.accent, fontSize: size }}>{full}</Text>
      <Text style={{ color: c.muted, fontSize: size }}>{empty}</Text>
    </View>
  );
}
