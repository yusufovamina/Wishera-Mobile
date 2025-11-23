import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';
import { Button } from '../components/Button';
import { WisheraLogo } from '../components/WisheraLogo';
import { Carousel } from '../components/Carousel';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;

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

// Feature showcase items
const features = [
  {
    icon: 'list' as const,
    title: 'Create Wishlists',
    description: 'Build your perfect wishlist with photos, links, and details. Organize by occasion or category.',
    color: colors.primary,
  },
  {
    icon: 'share-social' as const,
    title: 'Share with Friends',
    description: 'Connect with friends and family. Share your wishlists or browse theirs to find the perfect gift.',
    color: colors.accent,
  },
  {
    icon: 'gift' as const,
    title: 'Reserve Gifts',
    description: 'See what others want and reserve gifts to avoid duplicates. Track what you\'ve given and received.',
    color: colors.warning,
  },
  {
    icon: 'calendar' as const,
    title: 'Track Events',
    description: 'Never miss a birthday or special occasion. Get reminders and see upcoming events from your network.',
    color: colors.info,
  },
  {
    icon: 'chatbubble' as const,
    title: 'Stay Connected',
    description: 'Chat with friends about gifts, share ideas, and celebrate special moments together.',
    color: colors.success,
  },
];

// How it works steps
const howItWorks = [
  {
    step: 1,
    title: 'Sign Up',
    description: 'Create your free account in seconds. No credit card needed.',
    icon: 'person-add' as const,
  },
  {
    step: 2,
    title: 'Create Your Wishlist',
    description: 'Add items you want with photos, links, and notes.',
    icon: 'add-circle' as const,
  },
  {
    step: 3,
    title: 'Share & Connect',
    description: 'Follow friends, share wishlists, and discover what they want.',
    icon: 'people' as const,
  },
  {
    step: 4,
    title: 'Give & Receive',
    description: 'Reserve gifts, get notified about events, and celebrate together.',
    icon: 'gift' as const,
  },
];

// Use cases
const useCases = [
  {
    title: 'Birthday Wishlists',
    description: 'Share your birthday wishes with friends and family.',
    icon: 'gift' as const,
    color: colors.primary,
  },
  {
    title: 'Holiday Gifts',
    description: 'Plan holiday gift exchanges and keep track of what everyone wants.',
    icon: 'star' as const,
    color: colors.info,
  },
  {
    title: 'Wedding Registry',
    description: 'Create a registry for your special day and let guests know what you need.',
    icon: 'heart' as const,
    color: colors.warning,
  },
  {
    title: 'Special Occasions',
    description: 'Anniversaries, graduations, or any celebration - organize it all.',
    icon: 'star' as const,
    color: colors.accent,
  },
];

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const colorScheme = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  const renderFeatureCard = (feature: typeof features[0], index: number) => (
    <View key={index} style={styles.featureCard}>
      <LinearGradient
        colors={[hexToRgba(feature.color, 0.08), hexToRgba(feature.color, 0.03)]}
        style={styles.featureCardGradient}
      >
        <View style={[styles.featureIconContainer, { backgroundColor: hexToRgba(feature.color, 0.12) }]}>
          <Ionicons name={feature.icon} size={40} color={feature.color} />
        </View>
        <Text style={styles.featureCardTitle}>{feature.title}</Text>
        <Text style={styles.featureCardDescription}>{feature.description}</Text>
      </LinearGradient>
    </View>
  );

  const renderStepCard = (step: typeof howItWorks[0], index: number) => (
    <View key={index} style={styles.stepCard}>
      <View style={styles.stepNumberBadge}>
        <Text style={styles.stepNumber}>{step.step}</Text>
      </View>
      <View style={styles.stepIconContainer}>
        <Ionicons name={step.icon} size={32} color={colorScheme.primary} />
      </View>
      <Text style={styles.stepTitle}>{step.title}</Text>
      <Text style={styles.stepDescription}>{step.description}</Text>
    </View>
  );

  const renderUseCaseCard = (useCase: typeof useCases[0], index: number) => (
    <View key={index} style={styles.useCaseCard}>
      <LinearGradient
        colors={[hexToRgba(useCase.color, 0.08), hexToRgba(useCase.color, 0.02)]}
        style={styles.useCaseGradient}
      >
        <Ionicons name={useCase.icon} size={36} color={useCase.color} />
        <Text style={styles.useCaseTitle}>{useCase.title}</Text>
        <Text style={styles.useCaseDescription}>{useCase.description}</Text>
      </LinearGradient>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Section - What is Wishera? */}
        <View style={styles.heroSection}>
          <WisheraLogo size="lg" showText={false} style={styles.logo} />
          <Text style={styles.heroTitle}>
            {t('landing.whatIsWishera', 'What is Wishera?')}
          </Text>
          <Text style={styles.heroDescription}>
            {t('landing.heroDescription', 'Wishera is a social wishlist platform that helps you create, share, and manage wishlists with friends and family. Never forget what someone wants, and always give the perfect gift.')}
          </Text>
        </View>

        {/* Features Carousel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('landing.featuresTitle', 'What You Can Do')}
          </Text>
          <Carousel autoPlay={true} autoPlayInterval={5000} showDots={true}>
            {features.map((feature, index) => renderFeatureCard(feature, index))}
          </Carousel>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('landing.howItWorksTitle', 'How It Works')}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {t('landing.howItWorksSubtitle', 'Getting started is simple')}
          </Text>
          <Carousel autoPlay={true} autoPlayInterval={4500} showDots={true}>
            {howItWorks.map((step, index) => renderStepCard(step, index))}
          </Carousel>
        </View>

        {/* Use Cases Carousel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('landing.useCasesTitle', 'Perfect For Every Occasion')}
          </Text>
          <Carousel autoPlay={true} autoPlayInterval={5000} showDots={true}>
            {useCases.map((useCase, index) => renderUseCaseCard(useCase, index))}
          </Carousel>
        </View>

        {/* Why Choose Wishera */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>
            {t('landing.whyChooseTitle', 'Why Choose Wishera?')}
          </Text>
          <View style={styles.benefitsGrid}>
            <View style={styles.benefitBox}>
              <Ionicons name="shield-checkmark" size={28} color={colorScheme.success} />
              <Text style={styles.benefitTitle}>
                {t('landing.benefitSecure', 'Private & Secure')}
              </Text>
              <Text style={styles.benefitText}>
                {t('landing.benefitSecureText', 'You control who sees your wishlists')}
              </Text>
            </View>
            <View style={styles.benefitBox}>
              <Ionicons name="flash" size={28} color={colorScheme.warning} />
              <Text style={styles.benefitTitle}>
                {t('landing.benefitFast', 'Fast & Easy')}
              </Text>
              <Text style={styles.benefitText}>
                {t('landing.benefitFastText', 'Create wishlists in minutes')}
              </Text>
            </View>
            <View style={styles.benefitBox}>
              <Ionicons name="people" size={28} color={colorScheme.primary} />
              <Text style={styles.benefitTitle}>
                {t('landing.benefitSocial', 'Stay Connected')}
              </Text>
              <Text style={styles.benefitText}>
                {t('landing.benefitSocialText', 'Share with friends instantly')}
              </Text>
            </View>
            <View style={styles.benefitBox}>
              <Ionicons name="gift" size={28} color={colorScheme.accent} />
              <Text style={styles.benefitTitle}>
                {t('landing.benefitFree', 'Free Forever')}
              </Text>
              <Text style={styles.benefitText}>
                {t('landing.benefitFreeText', 'No hidden fees or subscriptions')}
              </Text>
            </View>
          </View>
        </View>

        {/* Social Proof - Simple Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>10K+</Text>
            <Text style={styles.statLabel}>
              {t('landing.statUsers', 'Active Users')}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>50K+</Text>
            <Text style={styles.statLabel}>
              {t('landing.statWishlists', 'Wishlists')}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>100K+</Text>
            <Text style={styles.statLabel}>
              {t('landing.statGifts', 'Gifts Shared')}
            </Text>
          </View>
        </View>

        {/* Final CTA - Only at the end */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>
            {t('landing.readyToStart', 'Ready to Get Started?')}
          </Text>
          <Text style={styles.ctaSubtitle}>
            {t('landing.ctaSubtitleNew', 'Join thousands of users sharing their wishlists')}
          </Text>
          <Button
            title={t('landing.getStarted', 'Get Started Free')}
            onPress={() => navigation.navigate('Register')}
            style={styles.ctaButton}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>
              {t('landing.alreadyHaveAccount', 'Already have an account? Sign in')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
    paddingTop: 20,
  },
  logo: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: width < 400 ? 32 : 36,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: width < 400 ? 38 : 44,
  },
  heroDescription: {
    fontSize: width < 400 ? 16 : 18,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: width < 400 ? 24 : 28,
    paddingHorizontal: 8,
  },
  section: {
    marginBottom: 48,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  featureCard: {
    width: CARD_WIDTH,
    minHeight: 280,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureCardGradient: {
    padding: 24,
    alignItems: 'center',
    minHeight: 280,
    width: '100%',
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  featureCardDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepCard: {
    width: CARD_WIDTH,
    minHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumberBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepIconContainer: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  useCaseCard: {
    width: CARD_WIDTH,
    minHeight: 280,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  useCaseGradient: {
    padding: 28,
    alignItems: 'center',
    minHeight: 280,
    width: '100%',
  },
  useCaseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  useCaseDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsSection: {
    marginBottom: 48,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  benefitBox: {
    width: (width - 40 - 16) / 2,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  ctaSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  ctaTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  ctaButton: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 20,
  },
  loginLink: {
    marginTop: 8,
  },
  loginLinkText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
});
