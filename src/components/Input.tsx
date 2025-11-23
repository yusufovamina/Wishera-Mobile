import React, { useState, useMemo } from 'react';
import { TextInput, StyleSheet, View, Text, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';

// Helper to convert hex to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex;
};

type InputProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  style?: ViewStyle;
};

export const Input: React.FC<InputProps> = ({ label, value, onChangeText, placeholder, secureTextEntry, style }) => {
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <Animated.View 
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
        ]}
      >
        {isFocused && (
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.05)', 'transparent']}
            style={styles.inputGradient}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          importantForAutofill="yes"
          textContentType={secureTextEntry ? "password" : "emailAddress"}
        />
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: { 
    gap: 8,
  },
  label: { 
    color: colors.textSecondary, 
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    boxShadow: `0px 0px 12px ${hexToRgba(colors.primary, 0.3)}`,
    elevation: 4,
  },
  inputGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    opacity: 0.3,
  },
  input: {
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
});


