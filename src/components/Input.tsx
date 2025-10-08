import React from 'react';
import { TextInput, StyleSheet, View, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type InputProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  style?: ViewStyle;
};

export const Input: React.FC<InputProps> = ({ label, value, onChangeText, placeholder, secureTextEntry, style }) => {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: colors.muted, fontSize: 14 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});


