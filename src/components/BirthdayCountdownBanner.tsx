import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, PanResponder, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { userApi, endpoints } from '../api/client';
import { SafeImage } from './SafeImage';
import { GiftIcon, CalendarIcon, EyeIcon, CloseIcon } from './Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

interface BirthdayReminderDTO {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  birthday: string;
  isToday: boolean;
  isTomorrow: boolean;
  daysUntilBirthday: number;
}

interface BirthdayCountdownBannerProps {
  onClose: () => void;
  onUserPress?: (userId: string) => void;
}

export const BirthdayCountdownBanner: React.FC<BirthdayCountdownBannerProps> = ({ onClose, onUserPress }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = createStyles(theme);
  const [birthdays, setBirthdays] = useState<BirthdayReminderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const swipeAnimations = useRef<Record<string, Animated.Value>>({});

  const getSwipeAnimation = (bannerId: string) => {
    if (!swipeAnimations.current[bannerId]) {
      swipeAnimations.current[bannerId] = new Animated.Value(0);
    }
    return swipeAnimations.current[bannerId];
  };

  const createPanResponder = (bannerId: string) => {
    const swipeX = getSwipeAnimation(bannerId);
    
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping left (negative dx)
        if (gestureState.dx < 0) {
          swipeX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swiped left enough, dismiss
          Animated.timing(swipeX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            handleDismissBanner(bannerId);
          });
        } else {
          // Spring back
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    });
  };

  useEffect(() => {
    fetchBirthdays();
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBirthdays = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userApi.get(endpoints.getUpcomingBirthdays(30));
      const birthdayDTOs = response.data || [];
      const birthdayReminders: BirthdayReminderDTO[] = birthdayDTOs.map((dto: any) => ({
        id: dto.id || dto.userId,
        userId: dto.userId,
        username: dto.username,
        avatarUrl: dto.avatarUrl || '',
        birthday: dto.birthday,
        isToday: dto.isToday,
        isTomorrow: dto.isTomorrow,
        daysUntilBirthday: dto.daysUntilBirthday
      }));
      
      const filteredBirthdays = birthdayReminders.filter(shouldShowNotification);
      setBirthdays(filteredBirthdays);
    } catch (err) {
      console.error('Error fetching birthdays:', err);
      setError('Failed to load birthday notifications');
    } finally {
      setLoading(false);
    }
  };

  const shouldShowNotification = (birthday: BirthdayReminderDTO) => {
    const daysLeft = birthday.daysUntilBirthday;
    
    if (daysLeft < 0) return false;
    if (birthday.isToday) return true;
    if (birthday.isTomorrow) return true;
    if (daysLeft <= 7) return true;
    if (daysLeft <= 30) return true;
    
    return false;
  };

  const formatCountdownMessage = (birthday: BirthdayReminderDTO) => {
    const daysLeft = birthday.daysUntilBirthday;
    
    if (birthday.isToday) {
      return t('notifications.birthdayToday', { username: birthday.username }, `${birthday.username}'s birthday is today! 🎉`);
    } else if (birthday.isTomorrow) {
      return t('notifications.birthdayTomorrow', { username: birthday.username }, `${birthday.username}'s birthday is tomorrow! 🎂`);
    } else if (daysLeft <= 7) {
      return t('notifications.birthdayThisWeek', { username: birthday.username, days: daysLeft }, `${birthday.username}'s birthday is in ${daysLeft} days`);
    } else if (daysLeft <= 30) {
      return t('notifications.birthdayThisMonth', { username: birthday.username, days: daysLeft }, `${birthday.username}'s birthday is in ${daysLeft} days`);
    } else {
      return t('notifications.birthdayNextMonth', { username: birthday.username, days: daysLeft }, `${birthday.username}'s birthday is in ${daysLeft} days`);
    }
  };

  const getBannerColor = (birthday: BirthdayReminderDTO) => {
    const daysLeft = birthday.daysUntilBirthday;
    
    if (birthday.isToday) {
      return ['#fce7f3', '#fdf2f8']; // pink
    } else if (birthday.isTomorrow) {
      return ['#f3e8ff', '#faf5ff']; // purple
    } else if (daysLeft <= 7) {
      return ['#eef2ff', '#f5f7ff']; // indigo
    } else if (daysLeft <= 30) {
      return ['#eff6ff', '#f0f9ff']; // blue
    } else {
      return ['#f9fafb', '#fafafa']; // gray
    }
  };

  const getBorderColor = (birthday: BirthdayReminderDTO) => {
    const daysLeft = birthday.daysUntilBirthday;
    
    if (birthday.isToday) {
      return '#ec4899'; // pink
    } else if (birthday.isTomorrow) {
      return '#a855f7'; // purple
    } else if (daysLeft <= 7) {
      return '#6366f1'; // indigo
    } else if (daysLeft <= 30) {
      return '#3b82f6'; // blue
    } else {
      return '#9ca3af'; // gray
    }
  };

  const getIcon = (birthday: BirthdayReminderDTO) => {
    const daysLeft = birthday.daysUntilBirthday;
    
    if (birthday.isToday) {
      return <GiftIcon size={24} color="#ec4899" />;
    } else if (daysLeft <= 7) {
      return <CalendarIcon size={24} color="#f97316" />;
    } else {
      return <CalendarIcon size={24} color="#3b82f6" />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const handleDismissBanner = (birthdayId: string) => {
    setDismissedBanners(prev => new Set(prev).add(birthdayId));
    // If all banners are dismissed, call onClose
    const remainingBanners = birthdays.filter(b => !dismissedBanners.has(`${b.userId}-${b.birthday}`));
    if (remainingBanners.length <= 1) {
      onClose();
    }
  };

  const visibleBirthdays = birthdays.filter(b => !dismissedBanners.has(`${b.userId}-${b.birthday}`));

  if (visibleBirthdays.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {visibleBirthdays.map((birthday, index) => {
        const bannerColors = getBannerColor(birthday);
        const borderColor = getBorderColor(birthday);
        const progress = Math.max(0, (30 - birthday.daysUntilBirthday) / 30 * 100);
        const bannerId = `${birthday.userId}-${birthday.birthday}`;
        
        const swipeX = getSwipeAnimation(bannerId);
        const panResponder = createPanResponder(bannerId);
        
        return (
          <Animated.View
            key={bannerId}
            style={[
              styles.banner,
              {
                opacity: Animated.multiply(
                  fadeAnim,
                  swipeX.interpolate({
                    inputRange: [-SCREEN_WIDTH, 0],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  })
                ),
                transform: [
                  { translateY: slideAnim },
                  { translateX: swipeX },
                ],
                borderLeftColor: borderColor,
                borderLeftWidth: 4,
              },
            ]}
            {...panResponder.panHandlers}
          >
            <LinearGradient
              colors={theme === 'dark' ? [bannerColors[0] + '40', bannerColors[1] + '40'] : bannerColors}
              style={styles.bannerGradient}
            >
              <View style={styles.bannerContent}>
                <View style={styles.bannerLeft}>
                  <View style={styles.iconContainer}>{getIcon(birthday)}</View>
                  <View style={styles.bannerInfo}>
                    <View style={styles.userRow}>
                      {birthday.avatarUrl && (
                        <SafeImage 
                          source={{ uri: birthday.avatarUrl }} 
                          style={styles.avatar}
                          fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(birthday.username)}`}
                          placeholder={birthday.username.charAt(0).toUpperCase()}
                        />
                      )}
                      <View style={styles.textContainer}>
                        <Text style={styles.messageText}>
                          {formatCountdownMessage(birthday)}
                        </Text>
                        <Text style={styles.usernameText}>
                          @{birthday.username}
                        </Text>
                      </View>
                    </View>
                    
                    {onUserPress && (
                      <TouchableOpacity
                        onPress={() => onUserPress(birthday.userId)}
                        style={styles.browseButton}
                      >
                        <LinearGradient
                          colors={[colors.primary, colors.accent]}
                          style={styles.browseButtonGradient}
                        >
                          <EyeIcon size={14} color="white" />
                          <Text style={styles.browseButtonText}>
                            {t('notifications.browseWishlist', undefined, 'Browse Wishlist')}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  onPress={() => {
                    const swipeX = getSwipeAnimation(bannerId);
                    Animated.timing(swipeX, {
                      toValue: -SCREEN_WIDTH,
                      duration: 200,
                      useNativeDriver: true,
                    }).start(() => {
                      handleDismissBanner(bannerId);
                    });
                  }}
                  style={styles.closeButton}
                >
                  <CloseIcon size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {/* Progress bar for countdown */}
              {!birthday.isToday && (
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progress}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        );
      })}
    </View>
  );
};

const createStyles = (theme: string) => StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: theme === 'dark' ? '#fca5a5' : '#dc2626',
    fontSize: 14,
  },
  banner: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerGradient: {
    padding: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  usernameText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  browseButton: {
    marginTop: 4,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  browseButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  browseButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});

