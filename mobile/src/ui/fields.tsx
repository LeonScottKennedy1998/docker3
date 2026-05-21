import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useThemeTokens } from '../context/ThemeContext';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  revealPassword?: boolean;
};

export function Field({
  label,
  error,
  style,
  secureTextEntry,
  revealPassword,
  ...rest
}: FieldProps) {
  const { c } = useThemeTokens();
  const [visible, setVisible] = useState(false);
  const useSecure = Boolean(secureTextEntry) && (revealPassword ? !visible : true);
  const borderColor = error ? c.danger : c.border;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      {revealPassword && secureTextEntry ? (
        <View
          style={[
            styles.inputRow,
            {
              borderColor,
              backgroundColor: c.card,
            },
          ]}
        >
          <TextInput
            placeholderTextColor={c.muted}
            style={[styles.inputGrow, { color: c.text }, style]}
            secureTextEntry={useSecure}
            {...rest}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}
            hitSlop={8}
            onPress={() => setVisible((v) => !v)}
            style={styles.eye}
          >
            <Text style={{ fontSize: 18 }}>{visible ? '👁️' : '👁️‍🗨️'}</Text>
          </Pressable>
        </View>
      ) : (
        <TextInput
          placeholderTextColor={c.muted}
          style={[
            styles.input,
            {
              color: c.text,
              borderColor,
              backgroundColor: c.card,
            },
            style,
          ]}
          secureTextEntry={secureTextEntry}
          {...rest}
        />
      )}
      {error ? <Text style={[styles.err, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingRight: 8,
    minHeight: 46,
  },
  inputGrow: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  eye: { paddingHorizontal: 8, paddingVertical: 6 },
  err: { fontSize: 12, marginTop: 4 },
});
