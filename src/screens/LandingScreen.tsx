import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { Carousel } from '../components/Carousel';
import { WisheraLogo } from '../components/WisheraLogo';

const { width, height } = Dimensions.get('window');

// Mock screenshot data
const appScreenshots = [
  {
    id: 1,
    title: 'Wishlist Creation',
    description: 'Create and manage your wishlists easily',
    iconName: 'document-text' as const,
    color: colors.primary,
  },
  {
    id: 2,
    title: 'Social Feed',
    description: 'Browse wishlists from friends and family',
    iconName: 'people' as const,
    color: colors.accent,
  },
  {
    id: 3,
    title: 'Chat Interface',
    description: 'Real-time messaging with SignalR',
    iconName: 'chatbubble' as const,
    color: colors.info,
  },
  {
    id: 4,
    title: 'Event Management',
    description: 'Track birthdays and special occasions',
    iconName: 'calendar' as const,
    color: colors.warning,
  },
  {
    id: 5,
    title: 'Profile & Privacy',
    description: 'Control your privacy settings',
    iconName: 'person' as const,
    color: colors.success,
  },
];

const howItWorksSteps = [
  { step: 1, title: 'Create', description: 'Build your wishlist', iconName: 'sparkles' as const, color: colors.primary },
  { step: 2, title: 'Share', description: 'Connect with friends', iconName: 'share-social' as const, color: colors.accent },
  { step: 3, title: 'Gift', description: 'Receive perfect gifts', iconName: 'gift' as const, color: colors.warning },
];

const useCases = [
  { title: 'Birthday Wishlists', iconName: 'gift' as const, description: 'Share your birthday wishes', color: colors.primary },
  { title: 'Wedding Registries', iconName: 'heart' as const, description: 'Create your dream registry', color: colors.accent },
  { title: 'Holiday Gifts', iconName: 'star' as const, description: 'Plan holiday gift exchanges', color: colors.warning },
];

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Fallback for rgba or other formats
  return hex.includes('rgba') ? hex : `rgba(99, 102, 241, ${opacity})`;
};

// Enhanced Icon Component with Gradient and Glow
const GradientIcon: React.FC<{
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  gradientColors: string[];
  style?: any;
}> = ({ name, size, gradientColors, style }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulse, glow]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  const iconSize = size * 1.8;
  const borderRadius = size * 0.9;

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Glow Effect */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: iconSize * 1.3,
            height: iconSize * 1.3,
            borderRadius: borderRadius * 1.3,
            backgroundColor: gradientColors[0],
            opacity: glowOpacity,
            boxShadow: `0 0 20px 0 ${gradientColors[0]}`,
            elevation: 10,
          },
        ]}
      />
      {/* Main Icon with Gradient */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: borderRadius,
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: `0 8px 16px 0 ${hexToRgba(gradientColors[0], 0.4)}`,
            elevation: 15,
          }}
        >
          <Ionicons name={name} size={size} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: 20,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: -20,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatY, pulse]);

  const getGradientColors = (color: string): string[] => {
    const colorMap: { [key: string]: string[] } = {
      [colors.primary]: ['#6366F1', '#8B5CF6'],
      [colors.accent]: ['#8B5CF6', '#A78BFA'],
      [colors.info]: ['#3B82F6', '#60A5FA'],
      [colors.warning]: ['#F59E0B', '#FBBF24'],
      [colors.success]: ['#10B981', '#34D399'],
    };
    return colorMap[color] || ['#6366F1', '#8B5CF6'];
  };

  const renderScreenshotSlide = (item: typeof appScreenshots[0]) => (
    <View style={styles.screenshotCardWrapper}>
      <View style={styles.screenshotCard}>
        <View style={styles.phoneFrame}>
          <View style={styles.phoneNotch} />
          <LinearGradient
            colors={getGradientColors(item.color)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.phoneScreen}
          >
            <View style={styles.statusBar}>
              <View style={styles.statusBarLeft}>
                <View style={styles.signalBars}>
                  <View style={[styles.signalBar, styles.signalBar1]} />
                  <View style={[styles.signalBar, styles.signalBar2]} />
                  <View style={[styles.signalBar, styles.signalBar3]} />
                  <View style={[styles.signalBar, styles.signalBar4]} />
                </View>
                <Text style={styles.statusBarText}>9:41</Text>
              </View>
              <View style={styles.statusBarRight}>
                <Text style={styles.statusBarText}>100%</Text>
                <View style={styles.battery}>
                  <View style={styles.batteryFill} />
                </View>
              </View>
            </View>
            <View style={styles.appContent}>
              <View style={{ marginBottom: 20 }}>
                <GradientIcon
                  name={item.iconName}
                  size={50}
                  gradientColors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                />
              </View>
              <Text style={styles.featureTitleLarge}>{item.title}</Text>
              <Text style={styles.featureDescriptionLarge}>{item.description}</Text>
            </View>
          </LinearGradient>
        </View>
        <View style={styles.cardLabel}>
          <Text style={styles.cardLabelText}>{item.title}</Text>
        </View>
      </View>
    </View>
  );

  // Section 1: Hero
  const HeroSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.heroSection}>
        <View style={styles.titleContainer}>
          <View style={styles.logoContainer}>
            <WisheraLogo size={width < 400 ? "md" : width < 600 ? "lg" : "xl"} showText={false} />
            <View style={styles.logoTextContainer}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.titleGradientWrapper}
              >
                <Text style={styles.title}>{t('landing.title', 'WISHERA')}</Text>
              </LinearGradient>
            </View>
          </View>
          <Text style={styles.headline}>{t('landing.headline', 'Create, Share, and Gift')}</Text>
          <Text style={styles.tagline}>
            {t('landing.tagline', 'Your Wishlist, Your Dreams, Your Way')}
          </Text>
          <View style={styles.titleUnderline} />
        </View>
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.95)', 'rgba(139, 92, 246, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.giftCard}
          >
            <View style={{ marginBottom: width < 400 ? 16 : 24 }}>
              <GradientIcon
                name="gift"
                size={width < 400 ? 50 : width < 600 ? 60 : 70}
                gradientColors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
              />
            </View>
            <Text style={styles.cardTitle}>{t('landing.cardTitle', 'Your Wishlist')}</Text>
            <Text style={styles.cardSubtitle}>
              {t('landing.cardSubtitle', 'Share your dreams with loved ones')}
            </Text>
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
              <Text style={styles.buttonText}>
                {t('landing.getStarted', 'Get Started')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          </LinearGradient>
        </View>
      </View>
    </View>
  );

  // Section 2: Features
  const FeaturesSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('landing.featuresTitle', 'Key Features')}</Text>
        <Text style={styles.sectionSubtitle}>
          {t('landing.featuresSubtitle', 'Everything you need to manage your wishlists')}
        </Text>
        <Carousel autoPlay={true} autoPlayInterval={4000} showDots={true}>
          <View style={styles.featureCardCarousel}>
            <GradientIcon
              name="checkmark-circle"
              size={width < 400 ? 42 : 50}
              gradientColors={[colors.success, '#34D399']}
            />
            <Text style={styles.featureTitle}>{t('landing.featureEasy', 'Easy to Use')}</Text>
            <Text style={styles.featureDescription}>
              {t('landing.featureEasyDesc', 'Intuitive interface for creating wishlists')}
            </Text>
          </View>
          <View style={styles.featureCardCarousel}>
            <GradientIcon
              name="lock-closed"
              size={width < 400 ? 42 : 50}
              gradientColors={[colors.primary, colors.accent]}
            />
            <Text style={styles.featureTitle}>
              {t('landing.featureSecure', 'Secure & Private')}
            </Text>
            <Text style={styles.featureDescription}>
              {t('landing.featureSecureDesc', 'Control your privacy settings')}
            </Text>
          </View>
          <View style={styles.featureCardCarousel}>
            <GradientIcon
              name="share-social"
              size={width < 400 ? 42 : 50}
              gradientColors={[colors.warning, '#FBBF24']}
            />
            <Text style={styles.featureTitle}>
              {t('landing.featureShare', 'Share Instantly')}
            </Text>
            <Text style={styles.featureDescription}>
              {t('landing.featureShareDesc', 'Connect with friends seamlessly')}
            </Text>
          </View>
        </Carousel>
      </View>
    </View>
  );

  // Section 3: Screenshots Carousel
  const ScreenshotsSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('landing.screenshotsTitle', 'See Wishera in Action')}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {t('landing.screenshotsSubtitle', 'Explore our key features')}
        </Text>
        <Carousel autoPlay={true} autoPlayInterval={4000} showDots={true}>
          {appScreenshots.map((item) => (
            <React.Fragment key={item.id}>
              {renderScreenshotSlide(item)}
            </React.Fragment>
          ))}
        </Carousel>
      </View>
    </View>
  );

  // Section 4: How It Works
  const HowItWorksSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('landing.howItWorksTitle', 'How It Works')}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {t('landing.howItWorksSubtitle', 'Get started in three simple steps')}
        </Text>
        <Carousel autoPlay={true} autoPlayInterval={4000} showDots={true}>
          {howItWorksSteps.map((step) => (
            <View key={step.step} style={styles.stepCardCarousel}>
              <View style={styles.stepNumberContainer}>
                <LinearGradient
                  colors={getGradientColors(step.color)}
                  style={styles.stepNumber}
                >
                  <Text style={styles.stepNumberText}>{step.step}</Text>
                </LinearGradient>
              </View>
              <GradientIcon
                name={step.iconName}
                size={width < 400 ? 48 : 56}
                gradientColors={getGradientColors(step.color)}
              />
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          ))}
        </Carousel>
      </View>
    </View>
  );

  // Section 5: Use Cases
  const UseCasesSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('landing.useCasesTitle', 'Perfect For Every Occasion')}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {t('landing.useCasesSubtitle', 'Create wishlists for any event')}
        </Text>
        <Carousel autoPlay={true} autoPlayInterval={4000} showDots={true}>
          {useCases.map((useCase, index) => (
            <View key={index} style={styles.useCaseCardCarousel}>
              <GradientIcon
                name={useCase.iconName}
                size={width < 400 ? 56 : 64}
                gradientColors={getGradientColors(useCase.color)}
              />
              <Text style={styles.useCaseTitle}>{useCase.title}</Text>
              <Text style={styles.useCaseDescription}>{useCase.description}</Text>
            </View>
          ))}
        </Carousel>
      </View>
    </View>
  );

  // Section 6: Social Features
  const SocialFeaturesSlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <View style={styles.socialFeaturesCard}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
            style={styles.socialFeaturesGradient}
          >
            <GradientIcon
              name="chatbubble"
              size={64}
              gradientColors={[colors.primary, colors.accent]}
            />
            <Text style={styles.socialFeaturesTitle}>
              {t('landing.socialFeaturesTitle', 'Stay Connected')}
            </Text>
            <Text style={styles.socialFeaturesDescription}>
              {t(
                'landing.socialFeaturesDesc',
                'Chat with friends, follow wishlists, and get notifications for special events'
              )}
            </Text>
            <View style={styles.socialFeaturesList}>
              <View style={styles.socialFeatureItem}>
                <GradientIcon
                  name="chatbubble"
                  size={32}
                  gradientColors={[colors.primary, colors.accent]}
                />
                <Text style={styles.socialFeatureText}>
                  {t('landing.socialFeatureChat', 'Real-time Chat')}
                </Text>
              </View>
              <View style={styles.socialFeatureItem}>
                <GradientIcon
                  name="people"
                  size={32}
                  gradientColors={[colors.info, '#60A5FA']}
                />
                <Text style={styles.socialFeatureText}>
                  {t('landing.socialFeatureFollow', 'Follow & Connect')}
                </Text>
              </View>
              <View style={styles.socialFeatureItem}>
                <GradientIcon
                  name="notifications"
                  size={32}
                  gradientColors={[colors.warning, '#FBBF24']}
                />
                <Text style={styles.socialFeatureText}>
                  {t('landing.socialFeatureNotify', 'Smart Notifications')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  );

  // Section 7: Privacy & CTA
  const PrivacyCTASlide = () => (
    <View style={[styles.slideContent, styles.sectionContainer]}>
      <View style={styles.section}>
        <View style={styles.privacyCard}>
          <GradientIcon
            name="shield-checkmark"
            size={64}
            gradientColors={[colors.success, '#34D399']}
          />
          <Text style={styles.privacyTitle}>
            {t('landing.privacyTitle', 'Privacy & Security')}
          </Text>
          <Text style={styles.privacyDescription}>
            {t(
              'landing.privacyDesc',
              'Your data is encrypted and secure. Control who sees your wishlists and profile information.'
            )}
          </Text>
        </View>
        <View style={styles.finalCTA}>
          <Text style={styles.finalCTATitle}>
            {t('landing.finalCTATitle', 'Ready to Get Started?')}
          </Text>
          <Text style={styles.finalCTADescription}>
            {t('landing.finalCTADescription', 'Join thousands of users sharing their dreams')}
          </Text>
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
              <Text style={styles.buttonText}>
                {t('landing.getStarted', 'Get Started')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {t('landing.signUp', 'Sign Up Free')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <View style={[styles.blobContainer, { pointerEvents: 'none' }]}>
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [{ translateY: floatY }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.35] }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [
                { translateY: floatY.interpolate({ inputRange: [-20, 20], outputRange: [10, -10] }) },
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.25] }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob3,
            {
              transform: [
                { translateY: floatY.interpolate({ inputRange: [-20, 20], outputRange: [-15, 15] }) },
              ],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.2] }),
            },
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroSlide />
        <FeaturesSlide />
        <ScreenshotsSlide />
        <HowItWorksSlide />
        <UseCasesSlide />
        <SocialFeaturesSlide />
        <PrivacyCTASlide />
      </ScrollView>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
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
      zIndex: 0,
    },
    blob: {
      position: 'absolute',
      borderRadius: 999,
    },
    blob1: {
      width: width * 1.2,
      height: width * 1.2,
      backgroundColor: colors.primary,
      top: -width * 0.4,
      right: -width * 0.3,
    },
    blob2: {
      width: width * 0.9,
      height: width * 0.9,
      backgroundColor: colors.accent,
      top: height * 0.15,
      left: -width * 0.2,
    },
    blob3: {
      width: width * 1,
      height: width * 1,
      backgroundColor: '#9333EA',
      bottom: -width * 0.4,
      right: -width * 0.2,
    },
    scrollContent: {
      flexGrow: 1,
    },
    sectionContainer: {
      minHeight: height * 0.8,
      justifyContent: 'center',
    },
    slideContent: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width < 400 ? 16 : 24,
      paddingVertical: width < 400 ? 40 : 60,
      zIndex: 10,
      overflow: 'visible',
    },
    heroSection: {
      alignItems: 'center',
      width: '100%',
      justifyContent: 'center',
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: width < 400 ? 16 : 24,
      width: '100%',
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: width < 400 ? 8 : 16,
    },
    logoTextContainer: {
      marginLeft: width < 400 ? 8 : 12,
    },
    titleGradientWrapper: {
      paddingHorizontal: 2,
    },
    title: {
      fontSize: width < 400 ? 32 : width < 600 ? 44 : 56,
      fontWeight: '900',
      letterSpacing: width < 400 ? 0.5 : 1,
      color: '#FFFFFF',
    },
    headline: {
      fontSize: width < 400 ? 18 : width < 600 ? 22 : 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: width < 400 ? 6 : 10,
      textAlign: 'center',
      paddingHorizontal: width < 400 ? 12 : 0,
    },
    tagline: {
      fontSize: width < 400 ? 12 : width < 600 ? 14 : 18,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: width < 400 ? 8 : 12,
      textAlign: 'center',
      paddingHorizontal: width < 400 ? 16 : 0,
      lineHeight: width < 400 ? 16 : 22,
    },
    titleUnderline: {
      width: width < 400 ? 50 : 80,
      height: width < 400 ? 2 : 3,
      backgroundColor: colors.gradientMid,
      borderRadius: 2,
      marginBottom: width < 400 ? 12 : 16,
    },
    glassCard: {
      borderRadius: width < 400 ? 16 : 24,
      overflow: 'hidden',
      boxShadow: width < 400 
        ? `0 6px 12px 0 rgba(99, 102, 241, 0.3)`
        : `0 12px 20px 0 rgba(99, 102, 241, 0.3)`,
      elevation: width < 400 ? 10 : 16,
      width: '100%',
      maxWidth: width < 400 ? width - 32 : 400,
    },
    giftCard: {
      padding: width < 400 ? 24 : width < 600 ? 36 : 48,
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: width < 400 ? 20 : width < 600 ? 28 : 36,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: width < 400 ? 6 : 10,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontSize: width < 400 ? 12 : width < 600 ? 14 : 18,
      color: 'rgba(255, 255, 255, 0.95)',
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: width < 400 ? 16 : 22,
    },
    section: {
      width: '100%',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    sectionSubtitle: {
      fontSize: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    featureCardCarousel: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: width < 400 ? 32 : 48,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 16px 0 rgba(99, 102, 241, 0.2)',
      elevation: 8,
      minHeight: width < 400 ? 280 : 300,
    },
    featureTitle: {
      fontSize: width < 400 ? 20 : 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: width < 400 ? 24 : 32,
      marginBottom: width < 400 ? 12 : 16,
      textAlign: 'center',
    },
    featureDescription: {
      fontSize: width < 400 ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: width < 400 ? 20 : 24,
      paddingHorizontal: width < 400 ? 12 : 16,
    },
    screenshotCardWrapper: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    screenshotCard: {
      width: '100%',
      alignItems: 'center',
    },
    phoneFrame: {
      width: 260,
      height: 520,
      backgroundColor: '#1a1a1a',
      borderRadius: 28,
      padding: 6,
      boxShadow: '0 20px 35px 0 rgba(0, 0, 0, 0.5)',
      elevation: 25,
      alignSelf: 'center',
    },
    phoneNotch: {
      position: 'absolute',
      top: 0,
      left: '50%',
      marginLeft: -35,
      width: 70,
      height: 18,
      backgroundColor: '#1a1a1a',
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      zIndex: 10,
    },
    phoneScreen: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: colors.primary,
    },
    statusBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    statusBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    signalBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 12,
      marginRight: 6,
    },
    signalBar: {
      width: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 1,
      marginRight: 2,
    },
    signalBar1: { height: 4 },
    signalBar2: { height: 6 },
    signalBar3: { height: 8 },
    signalBar4: { height: 10 },
    statusBarText: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    statusBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    battery: {
      width: 22,
      height: 11,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 2.5,
      marginLeft: 4,
      padding: 1.5,
    },
    batteryFill: {
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 1,
    },
    appContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    featureTitleLarge: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 10,
      textAlign: 'center',
    },
    featureDescriptionLarge: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.95)',
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    cardLabel: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: 24,
      boxShadow: '0 4px 12px 0 rgba(99, 102, 241, 0.1)',
      elevation: 6,
    },
    cardLabelText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    stepCardCarousel: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: width < 400 ? 32 : 48,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 16px 0 rgba(99, 102, 241, 0.2)',
      elevation: 8,
      minHeight: width < 400 ? 320 : 350,
    },
    stepNumberContainer: {
      marginBottom: 24,
    },
    stepNumber: {
      width: width < 400 ? 60 : 72,
      height: width < 400 ? 60 : 72,
      borderRadius: width < 400 ? 30 : 36,
      justifyContent: 'center',
      alignItems: 'center',
      boxShadow: '0 6px 12px 0 rgba(99, 102, 241, 0.4)',
      elevation: 10,
    },
    stepNumberText: {
      fontSize: width < 400 ? 28 : 32,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    stepTitle: {
      fontSize: width < 400 ? 22 : 26,
      fontWeight: '700',
      color: colors.text,
      marginTop: width < 400 ? 20 : 24,
      marginBottom: width < 400 ? 10 : 12,
      textAlign: 'center',
    },
    stepDescription: {
      fontSize: width < 400 ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: width < 400 ? 20 : 24,
      paddingHorizontal: width < 400 ? 12 : 16,
    },
    useCaseCardCarousel: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: width < 400 ? 32 : 48,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 16px 0 rgba(99, 102, 241, 0.2)',
      elevation: 8,
      minHeight: width < 400 ? 320 : 350,
    },
    useCaseTitle: {
      fontSize: width < 400 ? 22 : 26,
      fontWeight: '700',
      color: colors.text,
      marginTop: width < 400 ? 24 : 32,
      marginBottom: width < 400 ? 12 : 16,
      textAlign: 'center',
    },
    useCaseDescription: {
      fontSize: width < 400 ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: width < 400 ? 20 : 24,
      paddingHorizontal: width < 400 ? 12 : 16,
    },
    socialFeaturesCard: {
      borderRadius: 28,
      overflow: 'hidden',
      boxShadow: '0 12px 20px 0 rgba(99, 102, 241, 0.2)',
      elevation: 12,
      width: '100%',
      maxWidth: 500,
    },
    socialFeaturesGradient: {
      padding: 40,
      alignItems: 'center',
    },
    socialFeaturesTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginTop: 28,
      marginBottom: 16,
      textAlign: 'center',
    },
    socialFeaturesDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 24,
    },
    socialFeaturesList: {
      width: '100%',
    },
    socialFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 16,
      marginBottom: 16,
      boxShadow: '0 4px 8px 0 rgba(99, 102, 241, 0.1)',
      elevation: 4,
    },
    socialFeatureText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 16,
    },
    privacyCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 48,
      alignItems: 'center',
      boxShadow: '0 12px 20px 0 rgba(99, 102, 241, 0.15)',
      elevation: 12,
      width: '100%',
      maxWidth: 500,
      marginBottom: 40,
    },
    privacyTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginTop: 28,
      marginBottom: 16,
      textAlign: 'center',
    },
    privacyDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    finalCTA: {
      alignItems: 'center',
      width: '100%',
    },
    finalCTATitle: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    finalCTADescription: {
      fontSize: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
    },
    buttonContainer: {
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 12px 20px 0 rgba(99, 102, 241, 0.4)',
      elevation: 15,
      marginBottom: 20,
      width: '100%',
      maxWidth: 400,
    },
    button: {
      paddingVertical: 20,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    secondaryButton: {
      paddingVertical: 16,
      paddingHorizontal: 32,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '600',
    },
  });
