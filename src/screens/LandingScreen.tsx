import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Button } from '../components/Button';

const giftImages = [
  'https://www.google.com/url?sa=i&url=https%3A%2F%2Funsplash.com%2Fs%2Fphotos%2Fpurple-aesthetic&psig=AOvVaw19GSrhU_Ilf3wBTgk-mxoD&ust=1760025767285000&source=images&cd=vfe&opi=89978449&ved=0CBQQjRxqFwoTCJCMtIr9lJADFQAAAAAdAAAAABAf',
  'https://images.unsplash.com/photo-1603569240047-7d9d3f02a02d?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542992015-4a0b729b1385?q=80&w=1200&auto=format&fit=crop',
];

export const LandingScreen: React.FC<any> = ({ navigation }) => {
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(20)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;

  const { width } = Dimensions.get('window');
  const cardWidth = width - 40; // padding 20 on both sides

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -6, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 900, delay: 250, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(slideX, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(slideX, { toValue: -6, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(slideX, { toValue: 6, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        ),
      ]),
    ]).start();
  }, [floatY, pulse, slideX, fadeIn]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.background, '#0E1220', '#0B0F14']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={styles.heroWrap}>
        <View style={styles.badge}><Text style={styles.badgeText}>New</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.title}>Make wishes.</Text>
          <Animated.View style={[styles.spark, { opacity: pulse }]} />
        </View>
        <Text style={[styles.title, { color: colors.accent, marginTop: -6 }]}>Share joy.</Text>
        <Text style={styles.subtitle}>Create beautiful wishlists, discover gifts, and celebrate together.</Text>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1712178435871-48d630f15969?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cHVycGxlJTIwYWVzdGhldGljfGVufDB8fDB8fHww' }} style={styles.heroImage} />


        {/* Gift preview carousel */}
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {giftImages.map((uri, i) => {
            const inputRange = [(i - 1) * cardWidth, i * cardWidth, (i + 1) * cardWidth];
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
            return (
              <Animated.Image
                key={uri}
                source={{ uri }}
                style={[styles.giftCard, { width: cardWidth, transform: [{ scale }], opacity }]}
                resizeMode="cover"
              />
            );
          })}
        </Animated.ScrollView>

        {/* Dots indicator */}
        <View style={styles.dotsWrap}>
          {giftImages.map((_, i) => {
            const inputRange = [(i - 1) * cardWidth, i * cardWidth, (i + 1) * cardWidth];
            const dotScale = scrollX.interpolate({ inputRange, outputRange: [1, 1.6, 1], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { transform: [{ scale: dotScale }], opacity: dotOpacity }]} />;
          })}
        </View>
      </View>

      <View style={styles.cta}>
        <Button title="Continue" onPress={() => navigation.replace('Tabs')} />
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkMuted}>Create account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroWrap: { paddingHorizontal: 20, paddingTop: 60 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#142135', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderColor: colors.border, borderWidth: 1 },
  badgeText: { color: colors.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 18, color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '800' },
  subtitle: { marginTop: 10, color: colors.muted },
  heroImage: { width: '100%', height: 260, borderRadius: 20, marginTop: 18, borderColor: colors.border, borderWidth: 1 },
  heroImageSmall: { width: '100%', height: 150, borderRadius: 16, marginTop: 14, borderColor: colors.border, borderWidth: 1 },
  lampWrap: { position: 'absolute', right: 24, top: 220, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  lamp: { width: 68, height: 68 },
  glow: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, filter: undefined },
  spark: { width: 10, height: 10, borderRadius: 6, backgroundColor: colors.accent, marginLeft: 8 },
  giftCard: { height: 160, borderRadius: 16, marginRight: 16, borderColor: colors.border, borderWidth: 1 },
  dotsWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  cta: { position: 'absolute', left: 20, right: 20, bottom: 40, gap: 12 },
  link: { color: colors.text, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  linkMuted: { color: colors.muted, textAlign: 'center', marginTop: 2 },
});


