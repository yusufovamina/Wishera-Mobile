import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, StatusBar, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { WisheraLogo } from '../components/WisheraLogo';

const { width, height } = Dimensions.get('window');

interface CarouselItem {
  id: string;
  component: React.ReactNode;
}

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const colors = getColors();
  const styles = React.useMemo(() => createStyles(colors, theme), [colors, theme]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const pauseAutoScrollRef = useRef(false);
  const floatY1 = useRef(new Animated.Value(0)).current;
  const floatY2 = useRef(new Animated.Value(0)).current;
  const floatY3 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animated blob backgrounds
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(floatY1, { toValue: 30, duration: 15000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatY1, { toValue: -30, duration: 15000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(floatY2, { toValue: -20, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatY2, { toValue: 20, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(floatY3, { toValue: 20, duration: 20000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatY3, { toValue: -20, duration: 20000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [floatY1, floatY2, floatY3, pulse]);

  // Auto-scroll functionality
  useEffect(() => {
    const totalSlides = 5; // Total number of carousel slides
    const startAutoScroll = () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
      
      autoScrollTimerRef.current = setInterval(() => {
        if (!pauseAutoScrollRef.current && !isScrollingRef.current && flatListRef.current) {
          const nextIndex = (currentIndex + 1) % totalSlides;
          try {
            flatListRef.current.scrollToIndex({
              index: nextIndex,
              animated: true,
            });
          } catch {
            // Handle scroll error gracefully
          }
        }
      }, 4000); // Auto-scroll every 4 seconds
    };

    startAutoScroll();

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [currentIndex]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const onScrollBeginDrag = () => {
    isScrollingRef.current = true;
    pauseAutoScrollRef.current = true;
    // Resume auto-scroll after 8 seconds of no interaction
    setTimeout(() => {
      pauseAutoScrollRef.current = false;
    }, 8000);
  };

  const onScrollEndDrag = () => {
    isScrollingRef.current = false;
  };

  const onMomentumScrollEnd = () => {
    isScrollingRef.current = false;
  };

  const renderItem = ({ item }: { item: CarouselItem }) => (
    <View style={styles.carouselItem}>
      {item.component}
    </View>
  );

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {carouselItems.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.paginationDot,
              currentIndex === index && styles.paginationDotActive,
            ]}
            onPress={() => {
              pauseAutoScrollRef.current = true;
              isScrollingRef.current = true;
              try {
                flatListRef.current?.scrollToIndex({ 
                  index, 
                  animated: true 
                });
              } catch {
                // Handle scroll error gracefully
              }
              // Resume auto-scroll after 8 seconds
              setTimeout(() => {
                pauseAutoScrollRef.current = false;
                isScrollingRef.current = false;
              }, 8000);
            }}
          />
        ))}
      </View>
    );
  };

  // Hero Section Component
  const HeroSection = () => (
    <View style={styles.slideContainer}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('landing.title', 'WISHERA')}</Text>
        <Text style={styles.subtitle}>{t('landing.subtitle', 'Create, Share, and Gift')}</Text>
      </View>

      <View style={styles.glassCard}>
        <BlurView intensity={theme === 'dark' ? 60 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={theme === 'dark' 
            ? [colors.gradientStart + '30', colors.gradientMid + '20']
            : [colors.gradientStart + '20', colors.gradientMid + '15']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassCardContent}>
          <View style={styles.giftIconContainer}>
            <WisheraLogo size="lg" showText={false} />
          </View>
          <Text style={styles.glassCardTitle}>{t('landing.cardTitle', 'Your Wishlist')}</Text>
          <Text style={styles.glassCardSubtitle}>{t('landing.cardSubtitle', 'Share your dreams')}</Text>
        </View>
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <LinearGradient
            colors={[colors.success + '20', colors.successLight + '15']}
            style={styles.featureIcon}
          >
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          </LinearGradient>
          <Text style={styles.featureText}>{t('landing.featureEasy', 'Easy to use')}</Text>
        </View>
        <View style={styles.feature}>
          <LinearGradient
            colors={[colors.primary + '20', colors.primaryAlt + '15']}
            style={styles.featureIcon}
          >
            <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          </LinearGradient>
          <Text style={styles.featureText}>{t('landing.featureSecure', 'Secure & Private')}</Text>
        </View>
        <View style={styles.feature}>
          <LinearGradient
            colors={[colors.accent + '20', colors.accentLight + '15']}
            style={styles.featureIcon}
          >
            <Ionicons name="share-social" size={28} color={colors.accent} />
          </LinearGradient>
          <Text style={styles.featureText}>{t('landing.featureShare', 'Share Instantly')}</Text>
        </View>
      </View>
    </View>
  );

  // How It Works Section Component
  const HowItWorksSection = () => (
    <View style={styles.slideContainer}>
      <Text style={styles.sectionTitle}>{t('landing.howItWorks', 'How It Works')}</Text>
      <View style={styles.stepsContainer}>
        <View style={styles.stepCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.stepNumberContainer}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMid]}
              style={styles.stepNumber}
            >
              <Text style={styles.stepNumberText}>1</Text>
            </LinearGradient>
          </View>
          <Text style={styles.stepTitle}>{t('landing.step1', 'Create')}</Text>
          <Text style={styles.stepDescription}>{t('landing.step1Desc', 'Build your wishlist with items you love')}</Text>
        </View>
        <View style={styles.stepCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.stepNumberContainer}>
            <LinearGradient
              colors={[colors.gradientMid, colors.gradientEnd]}
              style={styles.stepNumber}
            >
              <Text style={styles.stepNumberText}>2</Text>
            </LinearGradient>
          </View>
          <Text style={styles.stepTitle}>{t('landing.step2', 'Share')}</Text>
          <Text style={styles.stepDescription}>{t('landing.step2Desc', 'Connect with friends and family')}</Text>
        </View>
        <View style={styles.stepCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.stepNumberContainer}>
            <LinearGradient
              colors={[colors.gradientEnd, colors.accent]}
              style={styles.stepNumber}
            >
              <Text style={styles.stepNumberText}>3</Text>
            </LinearGradient>
          </View>
          <Text style={styles.stepTitle}>{t('landing.step3', 'Gift')}</Text>
          <Text style={styles.stepDescription}>{t('landing.step3Desc', 'Reserve and receive perfect gifts')}</Text>
        </View>
      </View>
    </View>
  );

  // Use Cases Section Component
  const UseCasesSection = () => (
    <View style={styles.slideContainer}>
      <Text style={styles.sectionTitle}>{t('landing.useCases', 'Perfect For')}</Text>
      <View style={styles.useCasesContainer}>
        <View style={styles.useCaseCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.useCaseIconContainer}>
            <LinearGradient
              colors={[colors.primary + '20', colors.accent + '20']}
              style={styles.useCaseIcon}
            >
              <Ionicons name="gift" size={24} color={colors.primary} />
            </LinearGradient>
          </View>
          <Text style={styles.useCaseTitle}>{t('landing.useCaseBirthday', 'Birthday Wishlists')}</Text>
          <Text style={styles.useCaseDescription}>{t('landing.useCaseBirthdayDesc', 'Never miss a birthday gift idea')}</Text>
        </View>
        <View style={styles.useCaseCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.useCaseIconContainer}>
            <LinearGradient
              colors={[colors.accent + '20', colors.gradientMid + '20']}
              style={styles.useCaseIcon}
            >
              <Ionicons name="calendar" size={24} color={colors.accent} />
            </LinearGradient>
          </View>
          <Text style={styles.useCaseTitle}>{t('landing.useCaseEvents', 'Special Events')}</Text>
          <Text style={styles.useCaseDescription}>{t('landing.useCaseEventsDesc', 'Plan gifts for any special occasion')}</Text>
        </View>
        <View style={styles.useCaseCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.useCaseIconContainer}>
            <LinearGradient
              colors={[colors.gradientMid + '20', colors.primary + '20']}
              style={styles.useCaseIcon}
            >
              <Ionicons name="snow" size={24} color={colors.gradientMid} />
            </LinearGradient>
          </View>
          <Text style={styles.useCaseTitle}>{t('landing.useCaseHoliday', 'Holiday Gifts')}</Text>
          <Text style={styles.useCaseDescription}>{t('landing.useCaseHolidayDesc', 'Share your holiday wishlist')}</Text>
        </View>
      </View>
    </View>
  );

  // Features Section Component
  const FeaturesSection = () => (
    <View style={styles.slideContainer}>
      <Text style={styles.sectionTitle}>{t('landing.featuresTitle', 'Why Choose Wishera')}</Text>
      <View style={styles.extendedFeatures}>
        <View style={styles.extendedFeatureCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.extendedFeatureIconContainer}>
            <LinearGradient
              colors={[colors.info + '20', colors.infoLight + '20']}
              style={styles.extendedFeatureIcon}
            >
              <Ionicons name="chatbubbles" size={24} color={colors.info} />
            </LinearGradient>
          </View>
          <View style={styles.extendedFeatureContent}>
            <Text style={styles.extendedFeatureTitle}>{t('landing.featureChat', 'Real-time Chat')}</Text>
            <Text style={styles.extendedFeatureDescription}>{t('landing.featureChatDesc', 'Connect instantly with friends')}</Text>
          </View>
        </View>
        <View style={styles.extendedFeatureCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.extendedFeatureIconContainer}>
            <LinearGradient
              colors={[colors.success + '20', colors.successLight + '20']}
              style={styles.extendedFeatureIcon}
            >
              <Ionicons name="calendar" size={24} color={colors.success} />
            </LinearGradient>
          </View>
          <View style={styles.extendedFeatureContent}>
            <Text style={styles.extendedFeatureTitle}>{t('landing.featureEvents', 'Event Management')}</Text>
            <Text style={styles.extendedFeatureDescription}>{t('landing.featureEventsDesc', 'Organize birthdays and celebrations')}</Text>
          </View>
        </View>
        <View style={styles.extendedFeatureCard}>
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.extendedFeatureIconContainer}>
            <LinearGradient
              colors={[colors.primary + '20', colors.primaryAlt + '20']}
              style={styles.extendedFeatureIcon}
            >
              <Ionicons name="lock-closed" size={24} color={colors.primary} />
            </LinearGradient>
          </View>
          <View style={styles.extendedFeatureContent}>
            <Text style={styles.extendedFeatureTitle}>{t('landing.featurePrivacy', 'Privacy Control')}</Text>
            <Text style={styles.extendedFeatureDescription}>{t('landing.featurePrivacyDesc', 'Control who sees your wishlists')}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // CTA Section Component
  const CTASection = () => (
    <View style={styles.slideContainer}>
      <View style={styles.socialProofCard}>
        <BlurView intensity={theme === 'dark' ? 60 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={theme === 'dark'
            ? [colors.gradientStart + '25', colors.gradientMid + '15']
            : [colors.gradientStart + '15', colors.gradientMid + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.socialProofContent}>
          <Text style={styles.socialProofNumber}>1+ Users</Text>
          <Text style={styles.socialProofTitle}>{t('landing.socialProof', 'Join those 2 users who are already using Wishera')}</Text>
          <Text style={styles.socialProofDescription}>{t('landing.socialProofDesc', 'Creating and sharing wishlists every day')}</Text>
        </View>
      </View>

      <View style={styles.ctaSection}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
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
        <TouchableOpacity 
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.7}
          style={styles.secondaryButton}
        >
          <BlurView intensity={theme === 'dark' ? 40 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Text style={styles.secondaryButtonText}>{t('landing.learnMore', 'Learn More')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const carouselItems: CarouselItem[] = [
    { id: '1', component: <HeroSection /> },
    { id: '2', component: <HowItWorksSection /> },
    { id: '3', component: <UseCasesSection /> },
    { id: '4', component: <FeaturesSection /> },
    { id: '5', component: <CTASection /> },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {/* Subtle Background Gradient */}
      <View style={styles.backgroundGradient} pointerEvents="none">
        <LinearGradient
          colors={theme === 'dark' 
            ? [colors.background, colors.muted + '60', colors.background]
            : [colors.background, colors.muted + '40', colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      
      {/* Animated Background Blobs */}
      <View style={styles.blobContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            {
              transform: [{ translateY: floatY1 }, { translateX: floatY1.interpolate({ inputRange: [-30, 30], outputRange: [0, 20] }) }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.3] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            {
              transform: [{ translateY: floatY2 }, { translateX: floatY2.interpolate({ inputRange: [-20, 20], outputRange: [0, -30] }) }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.25] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob3,
            {
              transform: [{ translateY: floatY3 }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.25] })
            }
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob4,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.3] })
            }
          ]}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={carouselItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
      />

      {renderPagination()}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>, theme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  blobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    width: width * 0.96,
    height: width * 0.96,
    backgroundColor: colors.primary,
    top: -width * 0.24,
    right: -width * 0.24,
  },
  blob2: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: colors.accent,
    top: height * 0.1,
    left: -width * 0.15,
  },
  blob3: {
    width: width * 0.72,
    height: width * 0.72,
    backgroundColor: theme === 'dark' ? '#7C3AED' : '#9333EA',
    bottom: -width * 0.3,
    left: '50%',
  },
  blob4: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: theme === 'dark' ? '#EC4899' : '#F472B6', // Pinkish color
    top: height * 0.2,
    right: '20%',
  },
  flatList: {
    flex: 1,
    width: width,
  },
  flatListContent: {
    width: width * 5, // 5 carousel items
  },
  carouselItem: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  slideContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  pagination: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 28,
  },
  glassCard: {
    borderRadius: 24,
    marginBottom: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme === 'dark' ? 0.3 : 0.2,
    shadowRadius: 24,
    elevation: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCardContent: {
    padding: 36,
    alignItems: 'center',
  },
  giftIconContainer: {
    marginBottom: 20,
  },
  giftIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  glassCardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  glassCardSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
    width: '100%',
  },
  stepsContainer: {
    gap: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  stepCard: {
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme === 'dark' ? 0.2 : 0.1,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  stepNumberContainer: {
    marginBottom: 16,
  },
  stepNumber: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  useCasesContainer: {
    gap: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  useCaseCard: {
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme === 'dark' ? 0.2 : 0.1,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  useCaseIconContainer: {
    marginBottom: 16,
  },
  useCaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  useCaseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  useCaseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  extendedFeatures: {
    gap: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  extendedFeatureCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme === 'dark' ? 0.2 : 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  extendedFeatureIconContainer: {
    marginRight: 16,
  },
  extendedFeatureIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  extendedFeatureContent: {
    flex: 1,
  },
  extendedFeatureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  extendedFeatureDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  socialProofCard: {
    borderRadius: 24,
    padding: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme === 'dark' ? 0.3 : 0.2,
    shadowRadius: 24,
    elevation: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    alignSelf: 'center',
  },
  socialProofContent: {
    alignItems: 'center',
  },
  socialProofNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 12,
  },
  socialProofTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  socialProofDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  ctaSection: {
    gap: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  buttonContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme === 'dark' ? 0.4 : 0.3,
    shadowRadius: 16,
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
  secondaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
