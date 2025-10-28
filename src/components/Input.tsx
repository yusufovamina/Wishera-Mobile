import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Text, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const styles = StyleSheet.create({
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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


