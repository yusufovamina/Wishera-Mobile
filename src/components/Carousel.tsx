import React, { useRef, useState, useEffect } from 'react';
import { View, ScrollView, Dimensions, StyleSheet, NativeScrollEvent, NativeSyntheticEvent, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const CARD_SPACING = 16;
const NAV_BUTTON_SIZE = width < 400 ? 44 : 48;
const NAV_BUTTON_OFFSET = width < 400 ? 6 : 10;

interface CarouselProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  dotColor?: string;
  activeDotColor?: string;
}

export const Carousel: React.FC<CarouselProps> = ({
  children,
  autoPlay = true,
  autoPlayInterval = 4000,
  showDots = true,
  dotColor = colors.border,
  activeDotColor = colors.primary,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const carouselWrapperRef = useRef<View>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [carouselHeight, setCarouselHeight] = useState(350);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (autoPlay && !isScrolling && children.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % children.length;
          const sidePadding = (width - CARD_WIDTH) / 2;
          const scrollToX = sidePadding + nextIndex * (CARD_WIDTH + CARD_SPACING);
          scrollViewRef.current?.scrollTo({
            x: scrollToX,
            animated: true,
          });
          return nextIndex;
        });
      }, autoPlayInterval);

      return () => clearInterval(interval);
    }
  }, [autoPlay, autoPlayInterval, children.length, isScrolling, width]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const sidePadding = (width - CARD_WIDTH) / 2;
        const adjustedOffset = contentOffsetX - sidePadding;
        const index = Math.round(adjustedOffset / (CARD_WIDTH + CARD_SPACING));
        const clampedIndex = Math.max(0, Math.min(index, children.length - 1));
        if (clampedIndex >= 0 && clampedIndex < children.length) {
          setCurrentIndex(clampedIndex);
        }
      },
    }
  );

  const handleScrollBeginDrag = () => {
    setIsScrolling(true);
  };

  const handleScrollEndDrag = () => {
    setTimeout(() => setIsScrolling(false), autoPlayInterval);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const sidePadding = (width - CARD_WIDTH) / 2;
    const adjustedOffset = Math.max(0, contentOffsetX - sidePadding);
    const index = Math.round(adjustedOffset / (CARD_WIDTH + CARD_SPACING));
    const clampedIndex = Math.max(0, Math.min(index, children.length - 1));
    const snapToX = sidePadding + clampedIndex * (CARD_WIDTH + CARD_SPACING);
    
    scrollViewRef.current?.scrollTo({
      x: snapToX,
      animated: true,
    });
    
    setCurrentIndex(clampedIndex);
  };

  const scrollToIndex = (index: number) => {
    const sidePadding = (width - CARD_WIDTH) / 2;
    const scrollToX = sidePadding + index * (CARD_WIDTH + CARD_SPACING);
    scrollViewRef.current?.scrollTo({
      x: scrollToX,
      animated: true,
    });
    setCurrentIndex(index);
    setIsScrolling(true);
    setTimeout(() => setIsScrolling(false), autoPlayInterval);
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    } else {
      scrollToIndex(children.length - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < children.length - 1) {
      scrollToIndex(currentIndex + 1);
    } else {
      scrollToIndex(0);
    }
  };

  const sidePadding = (width - CARD_WIDTH) / 2;
  const totalContentWidth = sidePadding * 2 + children.length * CARD_WIDTH + (children.length - 1) * CARD_SPACING;

  const onCarouselLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setCarouselHeight(height);
    }
  };

  const buttonTop = carouselHeight / 2 - NAV_BUTTON_SIZE / 2;

  return (
    <View style={styles.container}>
      <View 
        ref={carouselWrapperRef}
        style={styles.carouselWrapper}
        onLayout={onCarouselLayout}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal={true}
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          decelerationRate={0.9}
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="start"
          contentContainerStyle={[
            styles.contentContainer,
            { 
              paddingLeft: sidePadding,
              paddingRight: sidePadding,
              minWidth: totalContentWidth,
            },
          ]}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          removeClippedSubviews={false}
          style={styles.scrollView}
        >
          {children.map((child, index) => {
            const sidePadding = (width - CARD_WIDTH) / 2;
            const inputRange = [
              sidePadding + (index - 1) * (CARD_WIDTH + CARD_SPACING),
              sidePadding + index * (CARD_WIDTH + CARD_SPACING),
              sidePadding + (index + 1) * (CARD_WIDTH + CARD_SPACING),
            ];

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.92, 1, 0.92],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.7, 1, 0.7],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.slideContainer,
                  {
                    width: CARD_WIDTH,
                    marginRight: index < children.length - 1 ? CARD_SPACING : 0,
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              >
                {child}
              </Animated.View>
            );
          })}
        </ScrollView>
        
        {children.length > 1 && (
          <>
            <TouchableOpacity
              style={[
                styles.navButton, 
                styles.navButtonLeft,
                { top: buttonTop }
              ]}
              onPress={goToPrevious}
              activeOpacity={0.8}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientMid]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navButtonGradient}
              >
                <Ionicons name="chevron-back" size={width < 400 ? 22 : 24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.navButton, 
                styles.navButtonRight,
                { top: buttonTop }
              ]}
              onPress={goToNext}
              activeOpacity={0.8}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientMid]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navButtonGradient}
              >
                <Ionicons name="chevron-forward" size={width < 400 ? 22 : 24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {showDots && children.length > 1 && (
        <View style={styles.dotsContainer}>
          {children.map((_, index) => {
            const sidePadding = (width - CARD_WIDTH) / 2;
            const inputRange = [
              sidePadding + (index - 1) * (CARD_WIDTH + CARD_SPACING),
              sidePadding + index * (CARD_WIDTH + CARD_SPACING),
              sidePadding + (index + 1) * (CARD_WIDTH + CARD_SPACING),
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 28, 6],
              extrapolate: 'clamp',
            });

            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  index < children.length - 1 && { marginRight: 8 },
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: index === currentIndex ? activeDotColor : dotColor,
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
    overflow: 'visible',
  },
  carouselWrapper: {
    position: 'relative',
    width: '100%',
    minHeight: 350,
  },
  scrollView: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    flexDirection: 'row',
  },
  slideContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: {
    position: 'absolute',
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    boxShadow: `0 4px 16px ${colors.primary}`,
    elevation: 30,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  navButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: NAV_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  navButtonLeft: {
    left: NAV_BUTTON_OFFSET,
  },
  navButtonRight: {
    right: NAV_BUTTON_OFFSET,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    height: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
});
