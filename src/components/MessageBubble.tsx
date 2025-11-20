import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    PanResponder,
    Dimensions,
    Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { SafeImage } from './SafeImage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ReplyIcon } from './Icon';
import {
    createDoubleTapHeartAnimation,
    createSwipeToReplyAnimation,
    createLongPressMenuAnimation,
    createReactionPopAnimation,
} from '../animations/MessageGestureAnimations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50;
const DOUBLE_TAP_DELAY = 300;

interface ChatMessage {
    id: string;
    userId?: string;
    senderId?: string;
    username?: string;
    text: string;
    sentAt?: string;
    createdAt?: string;
    reactions?: { [emoji: string]: string[] };
    replyToMessageId?: string;
    messageType?: 'text' | 'voice' | 'image' | 'video' | 'call';
    audioUrl?: string;
    audioDuration?: number;
    imageUrl?: string;
    videoUrl?: string;
    read?: boolean;
}

interface MessageBubbleProps {
    message: ChatMessage;
    isOwnMessage: boolean;
    currentUserId: string;
    repliedToMessage?: ChatMessage | null;
    onDoubleTap: (messageId: string) => void;
    onSwipeReply: (message: ChatMessage) => void;
    onLongPress: (messageId: string) => void;
    onReactionPress: (messageId: string, emoji: string) => void;
    onImagePress?: (imageUrl: string) => void;
    onVideoPress?: (videoUrl: string) => void;
    renderReplyPreview?: (message: ChatMessage, isOwnMessage: boolean) => React.ReactNode;
    renderVideoPlayer?: (videoUrl: string, messageId: string) => React.ReactNode;
    looksLikeImageUrl?: (url: string) => boolean;
    looksLikeVideoUrl?: (url: string) => boolean;
    isYouTubeUrl?: (url: string) => boolean;
    getYouTubeThumbnail?: (url: string) => string | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isOwnMessage,
    currentUserId,
    repliedToMessage,
    onDoubleTap,
    onSwipeReply,
    onLongPress,
    onReactionPress,
    onImagePress,
    onVideoPress,
    renderReplyPreview,
    renderVideoPlayer,
    looksLikeImageUrl,
    looksLikeVideoUrl,
    isYouTubeUrl,
    getYouTubeThumbnail,
}) => {
    const [lastTap, setLastTap] = useState<number>(0);
    const [showReactionMenu, setShowReactionMenu] = useState(false);

    const heartScale = useRef(new Animated.Value(0)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const swipeTranslateX = useRef(new Animated.Value(0)).current;
    const reactionMenuScale = useRef(new Animated.Value(0)).current;
    const reactionMenuOpacity = useRef(new Animated.Value(0)).current;
    const highlightOpacity = useRef(new Animated.Value(0)).current;

    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSwipingRef = useRef(false);

    const REACTION_EMOJIS = ['🔥', '❤️', '😆', '😮', '😢', '👍', '😡', '🎉', '👏', '🙏', '💯', '✨'];

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
            },
            onPanResponderGrant: () => {
                isSwipingRef.current = true;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx > 0 && gestureState.dx < 100) {
                    swipeTranslateX.setValue(gestureState.dx);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                isSwipingRef.current = false;

                if (gestureState.dx > SWIPE_THRESHOLD) {
                    onSwipeReply(message);
                }

                createSwipeToReplyAnimation(swipeTranslateX, 0).start();
            },
            onPanResponderTerminate: () => {
                isSwipingRef.current = false;
                createSwipeToReplyAnimation(swipeTranslateX, 0).start();
            },
        })
    ).current;

    const handlePress = useCallback(() => {
        const now = Date.now();

        if (now - lastTap < DOUBLE_TAP_DELAY) {
            onDoubleTap(message.id);

            heartOpacity.setValue(1);
            heartScale.setValue(0);
            createDoubleTapHeartAnimation(heartScale).start(() => {
                heartOpacity.setValue(0);
            });

            setLastTap(0);
        } else {
            setLastTap(now);
        }
    }, [lastTap, message.id, onDoubleTap, heartScale, heartOpacity]);

    const handleLongPressIn = useCallback(() => {
        longPressTimerRef.current = setTimeout(() => {
            if (!isSwipingRef.current) {
                setShowReactionMenu(true);
                onLongPress(message.id);
                createLongPressMenuAnimation(reactionMenuScale, reactionMenuOpacity, true).start();
            }
        }, 500);
    }, [message.id, onLongPress, reactionMenuScale, reactionMenuOpacity]);

    const handleLongPressOut = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const handleReactionSelect = useCallback((emoji: string) => {
        onReactionPress(message.id, emoji);
        setShowReactionMenu(false);
        createLongPressMenuAnimation(reactionMenuScale, reactionMenuOpacity, false).start();
    }, [message.id, onReactionPress, reactionMenuScale, reactionMenuOpacity]);

    const handleDismissReactionMenu = useCallback(() => {
        setShowReactionMenu(false);
        createLongPressMenuAnimation(reactionMenuScale, reactionMenuOpacity, false).start();
    }, [reactionMenuScale, reactionMenuOpacity]);

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, []);

    const formatTime = (timestamp?: string) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            const hours = date.getHours();
            const minutes = date.getMinutes();
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } catch {
            return '';
        }
    };

    const renderMessageContent = () => {
        if (message.messageType === 'voice' && message.audioUrl) {
            return (
                <VoiceMessagePlayer
                    audioUrl={message.audioUrl}
                    duration={message.audioDuration || 0}
                    isOwnMessage={isOwnMessage}
                />
            );
        }

        if (message.messageType === 'video' || (message.text && looksLikeVideoUrl?.(message.text))) {
            return renderVideoPlayer?.(message.videoUrl || message.text || '', message.id);
        }

        if (message.messageType === 'image' || (message.text && looksLikeImageUrl?.(message.text))) {
            return (
                <TouchableOpacity
                    style={styles.messageImageContainer}
                    onPress={() => onImagePress?.(message.imageUrl || message.text)}
                    activeOpacity={0.9}
                >
                    <SafeImage
                        source={{ uri: message.imageUrl || message.text }}
                        style={styles.messageImage}
                        resizeMode="cover"
                        placeholder=""
                        fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Image`}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                {message.text}
            </Text>
        );
    };

    return (
        <Animated.View
            style={[
                styles.messageContainer,
                isOwnMessage && styles.ownMessageContainer,
                { transform: [{ translateX: swipeTranslateX }] },
            ]}
            {...panResponder.panHandlers}
        >
            <Animated.View
                style={[
                    styles.swipeReplyIndicator,
                    {
                        opacity: swipeTranslateX.interpolate({
                            inputRange: [0, SWIPE_THRESHOLD],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                        }),
                    },
                ]}
            >
                <ReplyIcon size={24} color={colors.primary} />
            </Animated.View>

            <TouchableOpacity
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handleLongPressIn}
                onPressOut={handleLongPressOut}
                style={styles.touchableWrapper}
            >
                <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
                    {repliedToMessage && renderReplyPreview?.(repliedToMessage, isOwnMessage)}

                    {renderMessageContent()}

                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <View style={styles.reactionsContainer}>
                            {Object.entries(message.reactions).map(([emoji, userIds]) => {
                                if (userIds.length === 0) return null;
                                return (
                                    <TouchableOpacity
                                        key={emoji}
                                        style={[styles.reactionBadge, isOwnMessage && styles.ownReactionBadge]}
                                        onPress={() => onReactionPress(message.id, emoji)}
                                    >
                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                        <Text style={[styles.reactionCount, isOwnMessage && styles.ownReactionCount]}>
                                            {userIds.length}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                        {formatTime(message.sentAt || message.createdAt)}
                    </Text>
                </View>

                <Animated.View
                    style={[
                        styles.doubleTapHeart,
                        {
                            opacity: heartOpacity,
                            transform: [
                                { scale: heartScale },
                                {
                                    translateY: heartScale.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, -30],
                                    }),
                                },
                            ],
                        },
                    ]}
                    pointerEvents="none"
                >
                    <Text style={styles.heartEmoji}>❤️</Text>
                </Animated.View>
            </TouchableOpacity>

            {showReactionMenu && (
                <>
                    <TouchableOpacity
                        style={styles.reactionMenuBackdrop}
                        activeOpacity={1}
                        onPress={handleDismissReactionMenu}
                    />
                    <Animated.View
                        style={[
                            styles.reactionMenu,
                            isOwnMessage ? styles.reactionMenuRight : styles.reactionMenuLeft,
                            {
                                opacity: reactionMenuOpacity,
                                transform: [{ scale: reactionMenuScale }],
                            },
                        ]}
                    >
                        {REACTION_EMOJIS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                style={styles.reactionMenuItem}
                                onPress={() => handleReactionSelect(emoji)}
                            >
                                <Text style={styles.reactionMenuEmoji}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                </>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    messageContainer: {
        marginVertical: 4,
        marginHorizontal: 12,
        alignItems: 'flex-start',
    },
    ownMessageContainer: {
        alignItems: 'flex-end',
    },
    touchableWrapper: {
        maxWidth: '80%',
    },
    messageBubble: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 12,
        maxWidth: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    ownMessageBubble: {
        backgroundColor: colors.primary,
    },
    messageText: {
        fontSize: 16,
        color: colors.text,
        lineHeight: 22,
    },
    ownMessageText: {
        color: '#FFFFFF',
    },
    messageTime: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    ownMessageTime: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    messageImageContainer: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
    },
    reactionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 4,
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    ownReactionBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    reactionEmoji: {
        fontSize: 14,
    },
    reactionCount: {
        fontSize: 12,
        color: colors.text,
        fontWeight: '600',
    },
    ownReactionCount: {
        color: '#FFFFFF',
    },
    doubleTapHeart: {
        position: 'absolute',
        alignSelf: 'center',
        top: '50%',
        marginTop: -30,
    },
    heartEmoji: {
        fontSize: 60,
    },
    swipeReplyIndicator: {
        position: 'absolute',
        left: -40,
        top: '50%',
        marginTop: -12,
    },
    reactionMenuBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        backgroundColor: 'transparent',
    },
    reactionMenu: {
        position: 'absolute',
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingHorizontal: 8,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        gap: 4,
        top: -60,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    reactionMenuLeft: {
        left: 0,
    },
    reactionMenuRight: {
        right: 0,
    },
    reactionMenuItem: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    reactionMenuEmoji: {
        fontSize: 28,
    },
});
