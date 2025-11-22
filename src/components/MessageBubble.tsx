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
import { colors, darkColors, lightColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { SafeImage } from './SafeImage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ReplyIcon, EditIcon, DeleteIcon } from './Icon';
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
    onSwipeAction?: (message: ChatMessage, onComplete?: () => void) => void;
    onEditMessage?: (message: ChatMessage) => void;
    onDeleteMessage?: (message: ChatMessage) => void;
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
    onSwipeAction,
    onEditMessage,
    onDeleteMessage,
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
    const { theme } = usePreferences();
    const themeColors = theme === 'dark' ? darkColors : lightColors;
    const styles = React.useMemo(() => createStyles(theme, themeColors), [theme, themeColors]);
    const [lastTap, setLastTap] = useState<number>(0);
    const [showReactionMenu, setShowReactionMenu] = useState(false);

    const heartScale = useRef(new Animated.Value(0)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const swipeTranslateX = useRef(new Animated.Value(0)).current;
    const swipeActionTranslateX = useRef(new Animated.Value(0)).current;
    const reactionMenuScale = useRef(new Animated.Value(0)).current;
    const reactionMenuOpacity = useRef(new Animated.Value(0)).current;
    const highlightOpacity = useRef(new Animated.Value(0)).current;

    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSwipingRef = useRef(false);
    const actionMenuVisibleRef = useRef(false);
    const [showActionIcons, setShowActionIcons] = useState(false);
    const actionIconsOpacity = useRef(new Animated.Value(0)).current;

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
                // Swipe right (for reply) - works for all messages
                if (gestureState.dx > 0 && gestureState.dx < 100) {
                    swipeTranslateX.setValue(gestureState.dx);
                    swipeActionTranslateX.setValue(0); // Reset action swipe when swiping right
                    setShowActionIcons(false);
                    actionIconsOpacity.setValue(0);
                }
                // Swipe left (for edit/delete) - only for own messages
                else if (gestureState.dx < 0 && gestureState.dx > -100 && isOwnMessage && (onSwipeAction || onEditMessage || onDeleteMessage)) {
                    const absDx = Math.abs(gestureState.dx);
                    swipeActionTranslateX.setValue(absDx);
                    swipeTranslateX.setValue(0); // Reset reply swipe when swiping left
                    // Show icons when threshold is reached
                    if (absDx >= SWIPE_THRESHOLD) {
                        setShowActionIcons(true);
                        Animated.timing(actionIconsOpacity, {
                            toValue: 1,
                            duration: 100,
                            useNativeDriver: true,
                        }).start();
                    }
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                isSwipingRef.current = false;

                // Swipe right - reply
                if (gestureState.dx > SWIPE_THRESHOLD) {
                    onSwipeReply(message);
                    createSwipeToReplyAnimation(swipeTranslateX, 0).start();
                }
                // Swipe left - edit/delete (only for own messages)
                else if (gestureState.dx < -SWIPE_THRESHOLD && isOwnMessage && (onSwipeAction || onEditMessage || onDeleteMessage)) {
                    // Keep message swiped left to show icons
                    const swipeAmount = Math.max(Math.abs(gestureState.dx), SWIPE_THRESHOLD);
                    swipeActionTranslateX.setValue(swipeAmount);
                    
                    // Show action icons and keep them visible
                    setShowActionIcons(true);
                    actionMenuVisibleRef.current = true;
                    Animated.timing(actionIconsOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                    
                    // Keep icons visible for 5 seconds to allow interaction
                    setTimeout(() => {
                        if (actionMenuVisibleRef.current) {
                            actionMenuVisibleRef.current = false;
                            setShowActionIcons(false);
                            Animated.timing(actionIconsOpacity, {
                                toValue: 0,
                                duration: 200,
                                useNativeDriver: true,
                            }).start(() => {
                                createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
                            });
                        }
                    }, 5000);
                    
                    // If using Alert approach (onSwipeAction), show it
                    if (onSwipeAction) {
                        const resetAnimation = () => {
                            actionMenuVisibleRef.current = false;
                            setShowActionIcons(false);
                            Animated.timing(actionIconsOpacity, {
                                toValue: 0,
                                duration: 200,
                                useNativeDriver: true,
                            }).start(() => {
                                createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
                            });
                        };
                        
                        onSwipeAction(message, resetAnimation);
                    }
                }
                // Reset animations if threshold not reached
                else {
                    if (!showActionIcons) {
                        createSwipeToReplyAnimation(swipeTranslateX, 0).start();
                        createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
                    }
                }
            },
            onPanResponderTerminate: () => {
                isSwipingRef.current = false;
                createSwipeToReplyAnimation(swipeTranslateX, 0).start();
                createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
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
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText, !isOwnMessage && theme === 'dark' && styles.darkMessageText]}>
                {message.text}
            </Text>
        );
    };

    return (
        <Animated.View
            style={[
                styles.messageContainer,
                isOwnMessage && styles.ownMessageContainer,
                { 
                    transform: [
                        { translateX: Animated.add(swipeTranslateX, Animated.multiply(swipeActionTranslateX, -1)) }
                    ] 
                },
            ]}
            {...panResponder.panHandlers}
        >
            {/* Swipe right indicator (reply) */}
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

            {/* Swipe left indicator (edit/delete) - only for own messages */}
            {isOwnMessage && (onSwipeAction || onEditMessage || onDeleteMessage) && (
                <Animated.View
                    style={[
                        styles.swipeActionIndicator,
                        {
                            opacity: showActionIcons 
                                ? 1
                                : swipeActionTranslateX.interpolate({
                                    inputRange: [0, SWIPE_THRESHOLD],
                                    outputRange: [0, 1],
                                    extrapolate: 'clamp',
                                }),
                        },
                    ]}
                    pointerEvents={showActionIcons ? 'auto' : 'none'}
                >
                    <View style={styles.swipeActionIcons}>
                        {onEditMessage && (
                            <TouchableOpacity
                                style={styles.swipeActionButton}
                                onPress={() => {
                                    onEditMessage(message);
                                    setShowActionIcons(false);
                                    actionMenuVisibleRef.current = false;
                                    Animated.timing(actionIconsOpacity, {
                                        toValue: 0,
                                        duration: 200,
                                        useNativeDriver: true,
                                    }).start(() => {
                                        createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
                                    });
                                }}
                                activeOpacity={0.7}
                            >
                                <EditIcon size={24} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        {onDeleteMessage && (
                            <TouchableOpacity
                                style={styles.swipeActionButton}
                                onPress={() => {
                                    onDeleteMessage(message);
                                    setShowActionIcons(false);
                                    actionMenuVisibleRef.current = false;
                                    Animated.timing(actionIconsOpacity, {
                                        toValue: 0,
                                        duration: 200,
                                        useNativeDriver: true,
                                    }).start(() => {
                                        createSwipeToReplyAnimation(swipeActionTranslateX, 0).start();
                                    });
                                }}
                                activeOpacity={0.7}
                            >
                                <DeleteIcon size={24} color="#ff3b30" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            )}

            <TouchableOpacity
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handleLongPressIn}
                onPressOut={handleLongPressOut}
                style={styles.touchableWrapper}
            >
                <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble, !isOwnMessage && theme === 'dark' && styles.darkMessageBubble]}>
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
                                        <Text style={[styles.reactionCount, isOwnMessage && styles.ownReactionCount, !isOwnMessage && theme === 'dark' && styles.darkReactionCount]}>
                                            {userIds.length}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime, !isOwnMessage && theme === 'dark' && styles.darkMessageTime]}>
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

const createStyles = (theme: string, themeColors: typeof lightColors) => StyleSheet.create({
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
        backgroundColor: themeColors.surface,
        borderRadius: 16,
        padding: 12,
        maxWidth: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    darkMessageBubble: {
        backgroundColor: theme === 'dark' ? themeColors.muted : undefined,
    },
    ownMessageBubble: {
        backgroundColor: themeColors.primary,
    },
    messageText: {
        fontSize: 16,
        color: themeColors.text,
        lineHeight: 22,
    },
    darkMessageText: {
        color: '#FFFFFF',
    },
    ownMessageText: {
        color: '#FFFFFF',
    },
    messageTime: {
        fontSize: 11,
        color: themeColors.textSecondary,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    darkMessageTime: {
        color: 'rgba(255, 255, 255, 0.7)',
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
        color: themeColors.text,
        fontWeight: '600',
    },
    darkReactionCount: {
        color: '#FFFFFF',
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
    swipeActionIndicator: {
        position: 'absolute',
        right: -120,
        top: '50%',
        marginTop: -20,
        width: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swipeActionIcons: {
        flexDirection: 'row',
        gap: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swipeActionButton: {
        padding: 10,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
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
        flexWrap: 'wrap',
        backgroundColor: theme === 'dark' ? themeColors.muted : '#FFFFFF',
        borderRadius: 20,
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
        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        width: 200,
        justifyContent: 'flex-start',
    },
    reactionMenuLeft: {
        left: 0,
    },
    reactionMenuRight: {
        right: 0,
    },
    reactionMenuItem: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    reactionMenuEmoji: {
        fontSize: 28,
    },
});
