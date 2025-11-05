import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';

interface WisheraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  style?: ViewStyle;
}

export const WisheraLogo: React.FC<WisheraLogoProps> = ({ 
  size = 'md', 
  showText = true,
  style 
}) => {
  const { theme } = usePreferences();
  const colors = getColors();
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Rotating sparkle animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    ).start();
  }, []);

  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const iconSizeMap = {
    sm: 14,
    md: 18,
    lg: 28,
    xl: 36,
  };

  const sparkleSizeMap = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
  };

  const logoSize = sizeMap[size];
  const iconSize = iconSizeMap[size];
  const sparkleSize = sparkleSizeMap[size];

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Logo Icon Container */}
      <View style={styles.logoContainer}>
        {/* Background glow effect */}
        <View 
          style={[
            styles.glow,
            {
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize * 0.3,
            }
          ]}
        />
        
        {/* Main icon container with glassmorphism */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.iconContainer,
            {
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize * 0.3,
            }
          ]}
        >
          {/* Gift icon */}
          <Ionicons 
            name="gift" 
            size={iconSize} 
            color="#FFFFFF" 
            style={styles.giftIcon}
          />
          
          {/* Floating sparkles */}
          <Animated.View
            style={[
              styles.sparkle,
              {
                top: logoSize * 0.1,
                right: logoSize * 0.1,
                transform: [{ rotate }, { scale: scaleAnim }],
              }
            ]}
          >
            <Ionicons 
              name="star" 
              size={sparkleSize} 
              color="#FCD34D" 
            />
          </Animated.View>
          
          <Animated.View
            style={[
              styles.sparkle,
              {
                bottom: logoSize * 0.1,
                left: logoSize * 0.1,
                transform: [
                  { 
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['360deg', '0deg'],
                    })
                  },
                  { scale: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.2, 0.8],
                    })
                  }
                ],
              }
            ]}
          >
            <Ionicons 
              name="star" 
              size={sparkleSize * 0.75} 
              color="#F9A8D4" 
            />
          </Animated.View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#6366F1',
    opacity: 0.3,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  giftIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sparkle: {
    position: 'absolute',
  },
});

