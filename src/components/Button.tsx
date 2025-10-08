import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'ghost';
};

export const Button: React.FC<ButtonProps> = ({ title, onPress, loading, style, variant = 'primary' }) => {
  const isGhost = variant === 'ghost';
  return (
    <TouchableOpacity style={[styles.button, isGhost && styles.ghost, style]} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.text : '#fff'} />
      ) : (
        <Text style={[styles.text, isGhost && styles.textGhost]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  textGhost: { color: colors.text },
});


