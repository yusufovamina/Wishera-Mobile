import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { useAuthStore } from '../state/auth';

interface Notification {
  id: string;
  type: 'like' | 'follow' | 'gift' | 'message' | 'system';
  title: string;
  message: string;
  userId?: string;
  username?: string;
  avatar?: string;
  createdAt: string;
  isRead: boolean;
  actionData?: any;
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
      // Mock notifications for now - replace with actual API call
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'like',
          title: 'New Like',
          message: 'John Doe liked your "Birthday Wishlist"',
          userId: '1',
          username: 'John Doe',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=John',
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          isRead: false,
        },
        {
          id: '2',
          type: 'follow',
          title: 'New Follower',
          message: 'Jane Smith started following you',
          userId: '2',
          username: 'Jane Smith',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Jane',
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          isRead: false,
        },
        {
          id: '3',
          type: 'gift',
          title: 'Gift Reserved',
          message: 'Mike Johnson reserved "Wireless Headphones" from your wishlist',
          userId: '3',
          username: 'Mike Johnson',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Mike',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          isRead: true,
        },
        {
          id: '4',
          type: 'message',
          title: 'New Message',
          message: 'Sarah Wilson sent you a message',
          userId: '4',
          username: 'Sarah Wilson',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sarah',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          isRead: true,
        },
        {
          id: '5',
          type: 'system',
          title: 'Welcome to Wishera!',
          message: 'Complete your profile to get started',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          isRead: true,
        },
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.log('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    );

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'like':
        // Navigate to wishlist
        break;
      case 'follow':
        // Navigate to user profile
        break;
      case 'gift':
        // Navigate to wishlist
        break;
      case 'message':
        // Navigate to chat
        navigation.navigate('Chats');
        break;
      case 'system':
        // Handle system notification
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'follow':
        return '👤';
      case 'gift':
        return '🎁';
      case 'message':
        return '💬';
      case 'system':
        return '🔔';
      default:
        return '📢';
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

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationIcon}>
          <Text style={styles.notificationIconText}>{getNotificationIcon(item.type)}</Text>
        </View>
        
        <View style={styles.notificationInfo}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <Text style={styles.notificationTime}>
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>
        
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
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
  },
  unreadNotification: {
    backgroundColor: colors.muted,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  notificationIconText: {
    fontSize: 18,
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
});
