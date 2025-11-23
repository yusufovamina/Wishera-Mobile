import React, { useRef, useState, useEffect } from 'react';
import { View, ScrollView, Dimensions, StyleSheet, NativeScrollEvent, NativeSyntheticEvent, Animated } from 'react-native';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const CARD_SPACING = 16;

interface CarouselProps {
  children: React.ReactNode;
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
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Convert children to array if needed and ensure we have valid children
  const childrenArray = React.Children.toArray(children).filter(child => child != null);
  
  // Don't render if no children
  if (childrenArray.length === 0) {
    return null;
  }

  // Initialize scroll position on mount
  useEffect(() => {
    if (childrenArray.length > 0 && scrollViewRef.current) {
      const sidePadding = (width - CARD_WIDTH) / 2;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: sidePadding,
          animated: false,
        });
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (autoPlay && !isScrolling && childrenArray.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % childrenArray.length;
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
  }, [autoPlay, autoPlayInterval, childrenArray.length, isScrolling, width]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const sidePadding = (width - CARD_WIDTH) / 2;
        const adjustedOffset = contentOffsetX - sidePadding;
        const index = Math.round(adjustedOffset / (CARD_WIDTH + CARD_SPACING));
        const clampedIndex = Math.max(0, Math.min(index, childrenArray.length - 1));
        if (clampedIndex >= 0 && clampedIndex < childrenArray.length) {
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
    const clampedIndex = Math.max(0, Math.min(index, childrenArray.length - 1));
    const snapToX = sidePadding + clampedIndex * (CARD_WIDTH + CARD_SPACING);
    
    scrollViewRef.current?.scrollTo({
      x: snapToX,
      animated: true,
    });
    
    setCurrentIndex(clampedIndex);
  };


  const sidePadding = (width - CARD_WIDTH) / 2;

  return (
    <View style={styles.container}>
      <View 
        ref={carouselWrapperRef}
        style={styles.carouselWrapper}
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
            },
          ]}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          removeClippedSubviews={false}
          style={styles.scrollView}
        >
          {childrenArray.map((child, index) => {
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
                    marginRight: index < childrenArray.length - 1 ? CARD_SPACING : sidePadding,
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
      </View>
      
      {showDots && childrenArray.length > 1 && (
        <View style={styles.dotsContainer}>
          {childrenArray.map((_, index) => {
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
                  index < childrenArray.length - 1 && { marginRight: 8 },
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
    flexGrow: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    flexDirection: 'row',
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  slideContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
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
