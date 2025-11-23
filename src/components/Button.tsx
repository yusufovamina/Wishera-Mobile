import React, { useRef, useEffect, useMemo } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'ghost' | 'outline';
};

export const Button: React.FC<ButtonProps> = ({ title, onPress, loading, style, variant = 'primary' }) => {
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Use native driver only on native platforms, not on web
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!isGhost && !isOutline && !loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 2000, 
            easing: Easing.inOut(Easing.quad), 
            useNativeDriver: useNative 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 0, 
            duration: 2000, 
            easing: Easing.inOut(Easing.quad), 
            useNativeDriver: useNative 
          }),
        ])
      ).start();
    }
  }, [isGhost, isOutline, loading, pulseAnim, useNative]);

  const glowOpacity = pulseAnim.interpolate({ 
    inputRange: [0, 1], 
    outputRange: [0.2, 0.5] 
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: useNative,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: useNative,
    }).start();
  };

  if (isGhost || isOutline) {
    return (
      <TouchableOpacity 
        style={[isGhost ? styles.ghostButton : styles.outlineButton, style]} 
        onPress={onPress} 
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={isGhost ? styles.ghostText : styles.outlineText}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      onPress={onPress} 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={loading}
      activeOpacity={1}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Animated.View style={[styles.buttonGlow, { opacity: glowOpacity }]} />
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.text}>{title.toUpperCase()}</Text>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

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

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: `0px 4px 12px ${hexToRgba(colors.primary, 0.3)}`,
    elevation: 8,
  },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ghostText: { 
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  outlineText: { 
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
});


