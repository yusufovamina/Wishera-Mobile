import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { useAuthStore } from '../state/auth';
import { userApi, endpoints, getApiClient } from '../api/client';
import { HeartIcon, GiftIcon, CalendarIcon, ChatIcon, NotificationsIcon, CloseIcon, CheckIcon, PersonIcon, DocumentTextIcon } from '../components/Icon';

interface Notification {
  id: string;
  type: 'like' | 'follow' | 'gift' | 'message' | 'system' | 'event' | 'wishlist';
  title: string;
  message: string;
  userId?: string;
  username?: string;
  avatar?: string;
  avatarUrl?: string;
  createdAt: string;
  isRead: boolean;
  read: boolean;
  actionData?: any;
  relatedEntityId?: string;
  relatedEntityType?: string;
  invitationId?: string; // For event invitations
  invitationStatus?: 'pending' | 'accepted' | 'declined'; // For event invitations
}

export const NotificationsScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const notificationsEndpoint = endpoints.getNotifications(1, 50);
      const notificationApi = getApiClient(notificationsEndpoint);
      const response = await notificationApi.get(notificationsEndpoint);
      
      // Transform backend notifications to match our UI structure
      // Handle different response formats
      let backendNotifications: any[] = [];
      
      // Backend returns NotificationListDTO with Notifications property
      if (response.data?.Notifications && Array.isArray(response.data.Notifications)) {
        backendNotifications = response.data.Notifications;
      } else if (Array.isArray(response.data)) {
        backendNotifications = response.data;
      } else if (response.data?.items && Array.isArray(response.data.items)) {
        backendNotifications = response.data.items;
      } else if (response.data?.notifications && Array.isArray(response.data.notifications)) {
        backendNotifications = response.data.notifications;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        backendNotifications = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        // If it's a single object, wrap it in an array
        backendNotifications = [response.data];
      }
      
      console.log('Backend notifications format:', {
        isArray: Array.isArray(response.data),
        hasItems: !!response.data?.items,
        hasNotifications: !!response.data?.notifications,
        dataKeys: response.data ? Object.keys(response.data) : [],
        backendNotificationsLength: backendNotifications.length
      });
      
      const transformedNotifications: Notification[] = backendNotifications.map((notif: any) => {
        // Map backend notification types to our types
        let type: Notification['type'] = 'system';
        if (notif.type === 'Like' || notif.type === 'like') type = 'like';
        else if (notif.type === 'Follow' || notif.type === 'follow') type = 'follow';
        else if (notif.type === 'GiftReserved' || notif.type === 'giftReserved' || notif.type === 'gift') type = 'gift';
        else if (notif.type === 'Message' || notif.type === 'message') type = 'message';
        else if (notif.type === 'Event' || notif.type === 'event') type = 'event';
        else if (notif.type === 'Wishlist' || notif.type === 'wishlist') type = 'wishlist';
        
        return {
          id: notif.id || notif.notificationId || '',
          type,
          title: notif.title || notif.message || '',
          message: notif.message || notif.content || notif.title || '',
          userId: notif.userId || notif.fromUserId || notif.actorId,
          username: notif.username || notif.fromUsername || notif.actorUsername,
          avatar: notif.avatarUrl || notif.avatar || notif.fromUserAvatarUrl,
          avatarUrl: notif.avatarUrl || notif.avatar || notif.fromUserAvatarUrl,
          createdAt: notif.createdAt || notif.timestamp || new Date().toISOString(),
          isRead: notif.isRead !== undefined ? notif.isRead : (notif.read !== undefined ? notif.read : false),
          read: notif.isRead !== undefined ? notif.isRead : (notif.read !== undefined ? notif.read : false),
          relatedEntityId: notif.relatedEntityId || notif.entityId,
          relatedEntityType: notif.relatedEntityType || notif.entityType,
          actionData: notif.actionData || notif.data,
          invitationId: notif.invitationId || notif.invitation?.id,
          invitationStatus: notif.invitationStatus || notif.invitation?.status,
        };
      });
      
      setNotifications(transformedNotifications);
    } catch (error: any) {
      console.log('Error fetching notifications:', error);
      console.log('Error response:', error?.response?.data);
      // On error, show empty list instead of mock data
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      await handleMarkAsRead(notification);
    }

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'like':
        // Navigate to wishlist if we have the ID
        if (notification.relatedEntityId) {
          navigation.navigate('WishlistDetail', { 
            wishlistId: notification.relatedEntityId,
            wishlistTitle: notification.message 
          });
        }
        break;
      case 'follow':
        // Navigate to user profile
        if (notification.userId) {
          navigation.navigate('UserProfile', { userId: notification.userId });
        }
        break;
      case 'gift':
        // Navigate to wishlist or reserved gifts
        if (notification.relatedEntityId) {
          navigation.navigate('WishlistDetail', { 
            wishlistId: notification.relatedEntityId 
          });
        } else {
          navigation.navigate('ReservedGifts');
        }
        break;
      case 'message':
        // Navigate to chat
        if (notification.userId) {
          navigation.navigate('Chats', { userId: notification.userId });
        } else {
          navigation.navigate('Chats');
        }
        break;
      case 'event':
        // For event invitations, don't navigate on press - use accept/decline buttons instead
        // Only navigate if it's not an invitation notification
        if (notification.relatedEntityId && !notification.invitationId) {
          navigation.navigate('EventDetail', { eventId: notification.relatedEntityId });
        }
        break;
      case 'wishlist':
        // Navigate to wishlist
        if (notification.relatedEntityId) {
          navigation.navigate('WishlistDetail', { 
            wishlistId: notification.relatedEntityId 
          });
        }
        break;
      case 'system':
        // Handle system notification - might navigate to settings or profile
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconSize = 24;
    const iconColor = getNotificationColor(type);
    switch (type) {
      case 'like':
        return <HeartIcon size={iconSize} color={iconColor} />;
      case 'follow':
        return <PersonIcon size={iconSize} color={iconColor} />;
      case 'gift':
        return <GiftIcon size={iconSize} color={iconColor} />;
      case 'message':
        return <ChatIcon size={iconSize} color={iconColor} />;
      case 'event':
        return <CalendarIcon size={iconSize} color={iconColor} />;
      case 'wishlist':
        return <DocumentTextIcon size={iconSize} color={iconColor} />;
      case 'system':
        return <NotificationsIcon size={iconSize} color={iconColor} />;
      default:
        return <NotificationsIcon size={iconSize} color={iconColor} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'like':
        return colors.danger;
      case 'follow':
        return colors.primary;
      case 'gift':
        return colors.success;
      case 'message':
        return colors.info;
      case 'system':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.isRead) return;
    
    try {
      const notificationApi = getApiClient(endpoints.markNotificationRead);
      await notificationApi.put(endpoints.markNotificationRead, {
        NotificationIds: [notification.id]
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, isRead: true, read: true } : n)
      );
    } catch (error) {
      console.log('Error marking notification as read:', error);
      // Still update UI even if API call fails
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, isRead: true, read: true } : n)
      );
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const deleteEndpoint = endpoints.deleteNotification(notificationId);
      const notificationApi = getApiClient(deleteEndpoint);
      await notificationApi.delete(deleteEndpoint);
      
      // Remove from local state immediately
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== notificationId);
        console.log('Deleted notification, remaining count:', filtered.length);
        return filtered;
      });
    } catch (error: any) {
      console.log('Error deleting notification:', error);
      console.log('Error response:', error?.response?.data);
      // If deletion fails, show error but don't revert animation
      // The item will remain in the list but user can try again
      Alert.alert('Error', error?.response?.data?.message || 'Failed to delete notification');
    }
  };

  const handleRespondToInvitation = async (notification: Notification, accept: boolean) => {
    if (!notification.invitationId) {
      Alert.alert(t('common.error', 'Error'), t('notifications.invalidInvitation', 'Invalid invitation'));
      return;
    }

    try {
      const eventApi = getApiClient(endpoints.respondInvitation(notification.invitationId));
      await eventApi.post(endpoints.respondInvitation(notification.invitationId), { 
        status: accept ? 'accepted' : 'declined' 
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id 
            ? { ...n, invitationStatus: accept ? 'accepted' : 'declined', isRead: true, read: true }
            : n
        )
      );
      
      Alert.alert(
        t('common.success', 'Success'), 
        accept ? t('invitations.accepted', 'Invitation accepted!') : t('invitations.declined', 'Invitation declined')
      );
      
      // Refresh notifications
      await fetchNotifications();
    } catch (error: any) {
      console.error('Error responding to invitation:', error);
      Alert.alert(
        t('common.error', 'Error'), 
        error?.response?.data?.message || t('invitations.responseFailed', 'Failed to respond to invitation')
      );
    }
  };

  const SwipeableNotificationItem: React.FC<{ item: Notification }> = ({ item }) => {
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);
    const SWIPE_THRESHOLD = 80;
    const ACTION_WIDTH = 80;

    const isEventInvitation = item.type === 'event' && item.invitationId;
    const canRespond = isEventInvitation && item.invitationStatus === 'pending';

    const panGesture = Gesture.Pan()
      .onUpdate((e) => {
        // Allow swiping left (negative) for delete, right (positive) for mark as read
        if (e.translationX < 0) {
          // Swipe left - show delete action
          translateX.value = Math.max(e.translationX, -ACTION_WIDTH);
        } else if (e.translationX > 0 && !item.isRead) {
          // Swipe right - show mark as read action (only if unread)
          translateX.value = Math.min(e.translationX, ACTION_WIDTH);
        }
      })
      .onEnd((e) => {
        if (e.translationX < -SWIPE_THRESHOLD) {
          // Swipe left enough - trigger delete
          // Animate out first, then delete
          translateX.value = withTiming(-1000, { duration: 300 });
          opacity.value = withTiming(0, { duration: 300 }, (finished) => {
            if (finished) {
              // After animation completes, delete from API and remove from list
              runOnJS(handleDeleteNotification)(item.id);
            }
          });
        } else if (e.translationX > SWIPE_THRESHOLD && !item.isRead) {
          // Swipe right enough - trigger mark as read
          translateX.value = withSpring(ACTION_WIDTH);
          runOnJS(handleMarkAsRead)(item);
          setTimeout(() => {
            translateX.value = withSpring(0);
          }, 300);
        } else {
          // Snap back
          translateX.value = withSpring(0);
        }
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    }));

    const leftActionStyle = useAnimatedStyle(() => {
      const opacity = translateX.value < 0 ? Math.abs(translateX.value) / ACTION_WIDTH : 0;
      return {
        opacity: withTiming(opacity, { duration: 200 }),
      };
    });

    const rightActionStyle = useAnimatedStyle(() => {
      const opacity = translateX.value > 0 ? translateX.value / ACTION_WIDTH : 0;
      return {
        opacity: withTiming(opacity, { duration: 200 }),
      };
    });

    return (
      <View style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}>
        {/* Left Action - Delete (swipe left) */}
        <Animated.View style={[styles.swipeAction, styles.deleteAction, leftActionStyle]}>
          <CloseIcon size={24} color="white" />
          <Text style={styles.swipeActionText}>{t('notifications.delete', 'Delete')}</Text>
        </Animated.View>

        {/* Right Action - Mark as Read (swipe right, only if unread) */}
        {!item.isRead && (
          <Animated.View style={[styles.swipeAction, styles.readAction, rightActionStyle]}>
            <CheckIcon size={24} color="white" />
            <Text style={styles.swipeActionText}>{t('notifications.read', 'Read')}</Text>
          </Animated.View>
        )}

        {/* Main Content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <TouchableOpacity
              style={styles.notificationContent}
              onPress={() => !isEventInvitation && handleNotificationPress(item)}
              disabled={isEventInvitation}
            >
              {/* User Avatar or Icon */}
              {item.avatar || item.avatarUrl ? (
                <Image 
                  source={{ uri: item.avatar || item.avatarUrl }} 
                  style={styles.notificationAvatar}
                />
              ) : (
                <View style={styles.notificationIcon}>
                  {getNotificationIcon(item.type)}
                </View>
              )}
              
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationMessage}>{item.message}</Text>
                <Text style={styles.notificationTime}>
                  {getTimeAgo(item.createdAt)}
                </Text>
                {isEventInvitation && item.invitationStatus && item.invitationStatus !== 'pending' && (
                  <View style={[styles.statusBadge, { 
                    backgroundColor: item.invitationStatus === 'accepted' ? colors.success + '20' : colors.danger + '20' 
                  }]}>
                    <Text style={[styles.statusText, { 
                      color: item.invitationStatus === 'accepted' ? colors.success : colors.danger 
                    }]}>
                      {item.invitationStatus === 'accepted' 
                        ? t('invitations.accepted', 'Accepted')
                        : t('invitations.declined', 'Declined')}
                    </Text>
                  </View>
                )}
              </View>
              
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
        
        {/* Accept/Decline buttons for event invitations */}
        {canRespond && (
          <View style={styles.invitationActions}>
            <TouchableOpacity
              style={[styles.invitationButton, styles.acceptButton]}
              onPress={() => handleRespondToInvitation(item, true)}
            >
              <CheckIcon size={16} color="white" />
              <Text style={styles.invitationButtonText}>{t('notifications.accept', 'Accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.invitationButton, styles.declineButton]}
              onPress={() => handleRespondToInvitation(item, false)}
            >
              <CloseIcon size={16} color="white" />
              <Text style={styles.invitationButtonText}>{t('notifications.decline', 'Decline')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    return <SwipeableNotificationItem item={item} />;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return t('notifications.justNow', 'Just now');
    if (diffInSeconds < 3600) return t('notifications.minutesAgo', { minutes: Math.floor(diffInSeconds / 60) }, '{{minutes}}m ago');
    if (diffInSeconds < 86400) return t('notifications.hoursAgo', { hours: Math.floor(diffInSeconds / 3600) }, '{{hours}}h ago');
    return t('notifications.daysAgo', { days: Math.floor(diffInSeconds / 86400) }, '{{days}}d ago');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications.title', 'Notifications')}</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.notificationsList}
        extraData={notifications.length}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('notifications.empty', 'No notifications yet')}</Text>
            <Text style={styles.emptySubtext}>{t('notifications.emptyHint', "You'll see updates about likes, follows, and messages here")}</Text>
          </View>
        }
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // Notifications list styles
  notificationsList: {
    paddingVertical: 8,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  unreadNotification: {
    backgroundColor: colors.muted,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.muted,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 4,
  },

  // Empty state styles
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Invitation action styles
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  invitationButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  declineButton: {
    backgroundColor: colors.danger,
  },
  invitationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Swipe action styles
  swipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  deleteAction: {
    right: 0,
    backgroundColor: colors.danger,
  },
  readAction: {
    left: 0,
    backgroundColor: colors.success,
  },
  swipeActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
