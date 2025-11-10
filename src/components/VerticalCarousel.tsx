import React, { useRef, useState, useEffect } from 'react';
import { View, ScrollView, Dimensions, StyleSheet, NativeScrollEvent, NativeSyntheticEvent, Animated } from 'react-native';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface VerticalCarouselProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  dotColor?: string;
  activeDotColor?: string;
}

export const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
  children,
  autoPlay = false,
  autoPlayInterval = 5000,
  showDots = true,
  dotColor = colors.border,
  activeDotColor = colors.primary,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (autoPlay && !isScrolling && children.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % children.length;
          scrollViewRef.current?.scrollTo({
            y: nextIndex * height,
            animated: true,
          });
          return nextIndex;
        });
      }, autoPlayInterval);

      return () => clearInterval(interval);
    }
  }, [autoPlay, autoPlayInterval, children.length, isScrolling]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(contentOffsetY / height);
        if (index >= 0 && index < children.length) {
          setCurrentIndex(index);
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
    const contentOffsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(contentOffsetY / height);
    const snapToY = index * height;
    
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, Math.min(snapToY, (children.length - 1) * height)),
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        pagingEnabled={true}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={height}
        snapToAlignment="start"
      >
        {children.map((child, index) => (
          <View key={index} style={styles.slide}>
            {child}
          </View>
        ))}
      </ScrollView>
      {showDots && children.length > 1 && (
        <View style={styles.dotsContainer}>
          {children.map((_, index) => {
            const inputRange = [
              (index - 1) * height,
              index * height,
              (index + 1) * height,
            ];

            const dotScale = scrollY.interpolate({
              inputRange,
              outputRange: [0.8, 1.4, 0.8],
              extrapolate: 'clamp',
            });

            const dotOpacity = scrollY.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  index < children.length - 1 && styles.dotSpacing,
                  {
                    transform: [{ scale: dotScale }],
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
    flex: 1,
    width: '100%',
  },
  slide: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  dotsContainer: {
    position: 'absolute',
    right: 24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotSpacing: {
    marginBottom: 8,
  },
});

