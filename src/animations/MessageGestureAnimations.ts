import { Animated, Easing } from 'react-native';

export const createDoubleTapHeartAnimation = (animatedValue: Animated.Value) => {
    return Animated.parallel([
        Animated.sequence([
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
                toValue: 0,
                duration: 400,
                delay: 200,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
        ]),
    ]);
};

export const createSwipeToReplyAnimation = (
    translateX: Animated.Value,
    toValue: number,
    duration: number = 200
) => {
    return Animated.spring(translateX, {
        toValue,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
    });
};

export const createLongPressMenuAnimation = (
    scaleValue: Animated.Value,
    opacityValue: Animated.Value,
    show: boolean
) => {
    return Animated.parallel([
        Animated.spring(scaleValue, {
            toValue: show ? 1 : 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
            toValue: show ? 1 : 0,
            duration: 150,
            useNativeDriver: true,
        }),
    ]);
};

export const createReactionPopAnimation = (animatedValue: Animated.Value) => {
    return Animated.sequence([
        Animated.spring(animatedValue, {
            toValue: 1.2,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
        }),
        Animated.spring(animatedValue, {
            toValue: 1,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
        }),
    ]);
};

export const createMessageHighlightAnimation = (
    opacityValue: Animated.Value,
    highlight: boolean
) => {
    return Animated.timing(opacityValue, {
        toValue: highlight ? 0.3 : 0,
        duration: 200,
        useNativeDriver: true,
    });
};
