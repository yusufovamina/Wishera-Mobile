import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isGhost && !loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 2000, 
            easing: Easing.inOut(Easing.quad), 
            useNativeDriver: true 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 0, 
            duration: 2000, 
            easing: Easing.inOut(Easing.quad), 
            useNativeDriver: true 
          }),
        ])
      ).start();
    }
  }, [isGhost, loading, pulseAnim]);

  const glowOpacity = pulseAnim.interpolate({ 
    inputRange: [0, 1], 
    outputRange: [0.2, 0.5] 
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  if (isGhost) {
    return (
      <TouchableOpacity 
        style={[styles.ghostButton, style]} 
        onPress={onPress} 
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.ghostText}>{title}</Text>
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

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
});


