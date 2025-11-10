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
    sm: 32,
    md: 48,
    lg: 72,
    xl: 96,
  };

  const iconSizeMap = {
    sm: 18,
    md: 28,
    lg: 42,
    xl: 56,
  };

  const sparkleSizeMap = {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
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
        <Animated.View 
          style={[
            styles.glow,
            {
              width: logoSize * 1.2,
              height: logoSize * 1.2,
              borderRadius: logoSize * 0.3,
              opacity: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.4],
              }),
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
              borderRadius: logoSize * 0.25,
              shadowColor: colors.gradientStart,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 12,
            }
          ]}
        >
          {/* Animated background shimmer */}
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.5],
                }),
              }
            ]}
          />
          
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
                top: logoSize * 0.12,
                right: logoSize * 0.12,
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
                bottom: logoSize * 0.12,
                left: logoSize * 0.12,
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
      
      {/* Logo Text */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[
            styles.logoText, 
            { 
              fontSize: size === 'sm' ? 18 : size === 'md' ? 24 : size === 'lg' ? 32 : 40,
              color: colors.gradientStart,
            }
          ]}>
            Wishera
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#6366F1',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  giftIcon: {
    zIndex: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 3,
  },
  textContainer: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(99, 102, 241, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

