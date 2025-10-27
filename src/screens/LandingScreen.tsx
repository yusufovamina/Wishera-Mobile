import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Easing, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Button } from '../components/Button';

const giftImages = [
  'https://images.unsplash.com/photo-1603569240047-7d9d3f02a02d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542992015-4a0b729b1385?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=1200&auto=format&fit=crop',
];

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(50)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;
  const hologramOpacity = useRef(new Animated.Value(0)).current;

  const { width, height } = Dimensions.get('window');
  const cardWidth = width - 40;
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 414;

  useEffect(() => {
    // Floating animation for main elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { 
          toValue: -8, 
          duration: 2000, 
          easing: Easing.inOut(Easing.quad), 
          useNativeDriver: true 
        }),
        Animated.timing(floatY, { 
          toValue: 0, 
          duration: 2000, 
          easing: Easing.inOut(Easing.quad), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Pulse animation for glow effects
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { 
          toValue: 1, 
          duration: 1600, 
          easing: Easing.inOut(Easing.quad), 
          useNativeDriver: true 
        }),
        Animated.timing(pulse, { 
          toValue: 0, 
          duration: 1600, 
          easing: Easing.inOut(Easing.quad), 
          useNativeDriver: true 
        }),
      ])
    ).start();

    // Hologram rotation
    Animated.loop(
      Animated.timing(rotateY, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Particle system
    Animated.loop(
      Animated.sequence([
        Animated.timing(particleOpacity, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(particleOpacity, {
          toValue: 0,
          duration: 2000,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Hologram fade
    Animated.loop(
      Animated.sequence([
        Animated.timing(hologramOpacity, {
          toValue: 0.8,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hologramOpacity, {
          toValue: 0.3,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeIn, { 
        toValue: 1, 
        duration: 1200, 
        delay: 300, 
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true 
      }),
      Animated.timing(slideX, { 
        toValue: 0, 
        duration: 1200, 
        delay: 300,
        easing: Easing.out(Easing.cubic), 
        useNativeDriver: true 
      }),
      Animated.timing(scale, { 
        toValue: 1, 
        duration: 1200, 
        delay: 300,
        easing: Easing.out(Easing.back(1.2)), 
        useNativeDriver: true 
      }),
    ]).start();
  }, [floatY, pulse, slideX, fadeIn, rotateY, scale, particleOpacity, hologramOpacity]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const hologramRotation = rotateY.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background Gradient */}
      <LinearGradient 
        colors={['#1A0A2E', '#16213E', '#0F3460', '#533483']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={StyleSheet.absoluteFill} 
      />
      
      {/* Particle System Background */}
      <Animated.View style={[styles.particleContainer, { opacity: particleOpacity }]}>
        {[...Array(20)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: Math.random() * width,
                top: Math.random() * height,
                transform: [{ translateY: floatY }],
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Holographic Grid Background */}
      <Animated.View style={[styles.hologramGrid, { opacity: hologramOpacity }]}>
        <Animated.View 
          style={[
            styles.gridLine,
            { 
              transform: [{ rotate: hologramRotation }],
              opacity: 0.1,
            }
          ]} 
        />
      </Animated.View>

      <Animated.View 
        style={[
          styles.heroWrap,
          {
            opacity: fadeIn,
            transform: [
              { translateX: slideX },
              { scale: scale },
              { translateY: floatY }
            ]
          }
        ]}
      >
        {/* Sci-fi Badge */}
        <Animated.View style={[styles.badge, { transform: [{ scale: glowScale }] }]}>
          <LinearGradient
            colors={['#9C27B0', '#673AB7', '#3F51B5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeGradient}
          >
            <Text style={styles.badgeText}>NEURAL LINK ACTIVE</Text>
            <Animated.View style={[styles.badgeGlow, { opacity: glowOpacity }]} />
          </LinearGradient>
        </Animated.View>

        {/* Main Title with Sci-fi Typography */}
        <View style={styles.titleContainer}>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>WISH</Text>
            <Animated.View style={[styles.titleGlow, { opacity: pulse }]} />
          </Animated.View>
          <Text style={[styles.title, styles.titleAccent, isSmallScreen && styles.titleSmall]}>BEYOND</Text>
          <Text style={[styles.titleSub, isSmallScreen && styles.titleSubSmall]}>LIMITS</Text>
        </View>

        {/* Subtitle with Typewriter Effect */}
        <Animated.View style={[styles.subtitleContainer, { opacity: fadeIn }]}>
          <Text style={styles.subtitle}>
            Experience the future of wishlist creation with quantum-enhanced AI
          </Text>
          <Text style={styles.subtitleSecondary}>
            Neural networks analyze desires • Quantum encryption protects dreams
          </Text>
        </Animated.View>

        {/* Holographic Display */}
        <Animated.View 
          style={[
            styles.hologramDisplay,
            { 
              transform: [
                { translateY: floatY },
                { rotateY: hologramRotation }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(156, 39, 176, 0.1)', 'rgba(103, 58, 183, 0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hologramGradient}
          >
            <View style={styles.hologramContent}>
              <Text style={styles.hologramText}>SYSTEM STATUS</Text>
              <View style={styles.statusBar}>
                <Animated.View 
                  style={[
                    styles.statusFill,
                    { 
                      width: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['60%', '100%']
                      })
                    }
                  ]} 
                />
              </View>
              <Text style={styles.hologramSubtext}>Neural pathways: ACTIVE</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Enhanced Gift Carousel */}
        <Animated.View style={[styles.carouselContainer, { opacity: fadeIn }]}>
          <Text style={styles.carouselTitle}>QUANTUM GIFT MATRIX</Text>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }], 
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {giftImages.map((uri, i) => {
              const inputRange = [(i - 1) * cardWidth, i * cardWidth, (i + 1) * cardWidth];
              const cardScale = scrollX.interpolate({ 
                inputRange, 
                outputRange: [0.85, 1, 0.85], 
                extrapolate: 'clamp' 
              });
              const cardOpacity = scrollX.interpolate({ 
                inputRange, 
                outputRange: [0.5, 1, 0.5], 
                extrapolate: 'clamp' 
              });
              const cardGlow = scrollX.interpolate({ 
                inputRange, 
                outputRange: [0, 1, 0], 
                extrapolate: 'clamp' 
              });
              
              return (
                <Animated.View
                  key={uri}
                  style={[
                    styles.giftCardContainer,
                    { 
                      width: cardWidth,
                      transform: [{ scale: cardScale }],
                      opacity: cardOpacity
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(156, 39, 176, 0.2)', 'rgba(103, 58, 183, 0.1)']}
                    style={styles.giftCardGradient}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.giftCard}
                      resizeMode="cover"
                    />
                    <Animated.View 
                      style={[
                        styles.cardGlow,
                        { opacity: cardGlow }
                      ]} 
                    />
                  </LinearGradient>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          {/* Enhanced Dots Indicator */}
          <View style={styles.dotsWrap}>
            {giftImages.map((_, i) => {
              const inputRange = [(i - 1) * cardWidth, i * cardWidth, (i + 1) * cardWidth];
              const dotScale = scrollX.interpolate({ 
                inputRange, 
                outputRange: [1, 1.8, 1], 
                extrapolate: 'clamp' 
              });
              const dotOpacity = scrollX.interpolate({ 
                inputRange, 
                outputRange: [0.3, 1, 0.3], 
                extrapolate: 'clamp' 
              });
              return (
                <Animated.View 
                  key={i} 
                  style={[
                    styles.dot, 
                    { 
                      transform: [{ scale: dotScale }], 
                      opacity: dotOpacity 
                    }
                  ]} 
                />
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>

      {/* Enhanced CTA Section */}
      <Animated.View 
        style={[
          styles.cta,
          {
            opacity: fadeIn,
            transform: [{ translateY: floatY }]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#9C27B0', '#673AB7', '#3F51B5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.primaryButtonText}>CONTINUE</Text>
            <Animated.View style={[styles.buttonGlow, { opacity: pulse }]} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
    overflow: 'hidden'
  },
  
  // Particle System
  particleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#9C27B0',
    borderRadius: 1,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  
  // Holographic Grid
  hologramGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  gridLine: {
    position: 'absolute',
    width: '200%',
    height: 1,
    backgroundColor: '#9C27B0',
    opacity: 0.1,
    top: '50%',
    left: '-50%',
  },
  
  // Main Content
  heroWrap: { 
    paddingHorizontal: 20, 
    paddingTop: 60,
    zIndex: 2,
    flex: 1,
  },
  
  // Sci-fi Badge
  badge: { 
    alignSelf: 'flex-start', 
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  badgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'relative',
  },
  badgeText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 11, 
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  badgeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#9C27B0',
    opacity: 0.3,
  },
  
  // Title Section
  titleContainer: {
    marginTop: 30,
    alignItems: 'flex-start',
  },
  title: { 
    color: colors.text, 
    fontSize: 42, 
    lineHeight: 48, 
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#9C27B0',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleAccent: {
    color: '#9C27B0',
    marginTop: -8,
  },
  titleSub: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 4,
    marginTop: -8,
  },
  titleSmall: {
    fontSize: 32,
    lineHeight: 36,
  },
  titleSubSmall: {
    fontSize: 18,
    letterSpacing: 2,
  },
  titleGlow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9C27B0',
    marginLeft: 12,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  
  // Subtitle
  subtitleContainer: {
    marginTop: 20,
    maxWidth: '90%',
  },
  subtitle: { 
    color: colors.text, 
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  subtitleSecondary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '300',
    letterSpacing: 0.3,
    marginTop: 8,
  },
  
  // Holographic Display
  hologramDisplay: {
    marginTop: 30,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.3)',
  },
  hologramGradient: {
    padding: 20,
  },
  hologramContent: {
    alignItems: 'center',
  },
  hologramText: {
    color: '#9C27B0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  statusBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  statusFill: {
    height: '100%',
    backgroundColor: '#9C27B0',
    borderRadius: 2,
  },
  hologramSubtext: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  
  // Carousel
  carouselContainer: {
    marginTop: 30,
  },
  carouselTitle: {
    color: '#9C27B0',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: 'center',
  },
  carousel: {
    marginHorizontal: -20,
  },
  carouselContent: {
    paddingHorizontal: 20,
  },
  giftCardContainer: {
    marginRight: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  giftCardGradient: {
    borderRadius: 20,
    padding: 2,
  },
  giftCard: { 
    height: 180, 
    borderRadius: 18,
    width: '100%',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#9C27B0',
    opacity: 0.2,
    borderRadius: 18,
  },
  dotsWrap: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12, 
    marginTop: 16 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#9C27B0',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  
  // CTA Section
  cta: { 
    position: 'absolute', 
    left: 20, 
    right: 20, 
    bottom: 40, 
    zIndex: 3,
    paddingBottom: 20,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#9C27B0',
    opacity: 0.3,
  },
});


