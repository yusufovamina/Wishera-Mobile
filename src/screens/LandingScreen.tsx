import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Easing, Dimensions, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { usePreferences } from '../state/preferences';

const { width, height } = Dimensions.get('window');

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating animation for blobs - smoother
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { 
          toValue: 20, 
          duration: 8000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
        Animated.timing(floatY, { 
          toValue: -20, 
          duration: 8000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Pulse animation - smoother
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { 
          toValue: 1, 
          duration: 3000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
        Animated.timing(pulse, { 
          toValue: 0, 
          duration: 3000, 
          easing: Easing.inOut(Easing.sin), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Fade in
    Animated.timing(fadeIn, { 
      toValue: 1, 
      duration: 1200, 
      easing: Easing.out(Easing.cubic), 
      useNativeDriver: true 
    }).start();
  }, [floatY, pulse, fadeIn]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background Blobs - Matching wishera-front */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [
                { translateY: floatY }
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.4] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [
                { translateY: floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.3] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob3,
            {
              transform: [
                { translateY: floatY.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.25] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob4,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.15] })
            }
          ]}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeIn }]}>
          {/* Logo/Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t('landing.title', 'WISHERA')}</Text>
            <Text style={styles.subtitle}>{t('landing.subtitle', 'Create, Share, and Gift')}</Text>
            <View style={styles.titleUnderline} />
          </View>

          {/* Glassmorphism Card - Matching wishera-front design */}
          <View style={styles.glassCard}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMid]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.giftCard}
            >
              <View style={styles.giftIconContainer}>
                <Text style={styles.giftIcon}>🎁</Text>
              </View>
              <Text style={styles.cardTitle}>{t('landing.cardTitle', 'Your Wishlist')}</Text>
              <Text style={styles.cardSubtitle}>{t('landing.cardSubtitle', 'Share your dreams')}</Text>
            </LinearGradient>
          </View>

          {/* Features */}
          <View style={styles.features}>
            <View style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: colors.success }]}>
                <Text style={styles.featureIconText}>✓</Text>
              </View>
              <Text style={styles.featureText}>{t('landing.featureEasy', 'Easy to use')}</Text>
            </View>
            <View style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary }]}>
                <Text style={styles.featureIconText}>🔒</Text>
              </View>
              <Text style={styles.featureText}>{t('landing.featureSecure', 'Secure & Private')}</Text>
            </View>
            <View style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: colors.warning }]}>
                <Text style={styles.featureIconText}>🎯</Text>
              </View>
              <Text style={styles.featureText}>{t('landing.featureShare', 'Share Instantly')}</Text>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.9}
            style={styles.buttonContainer}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{t('landing.getStarted', 'Get Started')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  blobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.3,
  },
  blob1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: colors.primary,
    top: -width * 0.2,
    right: -width * 0.2,
  },
  blob2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: colors.accent,
    top: height * 0.1,
    left: -width * 0.15,
  },
  blob3: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: '#9333EA',
    bottom: -width * 0.3,
    left: '50%',
  },
  blob4: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: colors.warningLight,
    top: height * 0.2,
    right: '20%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    backgroundColor: colors.gradientStart,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 16,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    backgroundColor: colors.gradientMid,
    borderRadius: 2,
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  giftCard: {
    padding: 32,
    alignItems: 'center',
  },
  giftIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  giftIcon: {
    fontSize: 40,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
