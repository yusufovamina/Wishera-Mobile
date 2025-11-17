import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../state/auth';
import { chatApi, userApi, endpoints } from '../api/client';

interface ChatNotification {
  contactId: string;
  unreadCount: number;
  lastMessageTime: string;
}

export const useChatNotifications = () => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Map<string, ChatNotification>>(new Map());
  const [totalUnread, setTotalUnread] = useState(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTotalUnread = useCallback((notifs: Map<string, ChatNotification>) => {
    let total = 0;
    notifs.forEach(notif => {
      total += notif.unreadCount;
    });
    return total;
  }, []);

  const updateNotification = useCallback((contactId: string, unreadCount: number, lastMessageTime: string) => {
    setNotifications(prev => {
      const updated = new Map(prev);
      if (unreadCount > 0) {
        updated.set(contactId, { contactId, unreadCount, lastMessageTime });
      } else {
        updated.delete(contactId);
      }
      setTotalUnread(calculateTotalUnread(updated));
      return updated;
    });
  }, [calculateTotalUnread]);

  const clearNotification = useCallback((contactId: string) => {
    setNotifications(prev => {
      const updated = new Map(prev);
      updated.delete(contactId);
      setTotalUnread(calculateTotalUnread(updated));
      return updated;
    });
  }, [calculateTotalUnread]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const followingResponse = await userApi.get(endpoints.getFollowing(user.id, 1, 50));
      const followingUsers = Array.isArray(followingResponse.data) 
        ? followingResponse.data 
        : (followingResponse.data?.items || followingResponse.data?.data || []);

      const newNotifications = new Map<string, ChatNotification>();

      await Promise.all(
        followingUsers.map(async (contactUser: any) => {
          try {
            const historyResponse = await chatApi.get(endpoints.chatHistory(user.id, contactUser.id, 1, 50));
            const messages = Array.isArray(historyResponse.data) 
              ? historyResponse.data 
              : (historyResponse.data?.items || historyResponse.data?.data || []);

            if (messages.length > 0) {
              const unreadCount = messages.filter((m: any) => {
                const senderId = m.userId || m.senderId || m.fromUserId;
                const isFromOtherUser = senderId !== user.id;
                const readStatus = m.read !== undefined ? m.read : (m.isRead !== undefined ? m.isRead : false);
                return isFromOtherUser && !readStatus;
              }).length;

              if (unreadCount > 0) {
                const lastMsg = messages[0];
                const lastMessageTime = lastMsg.sentAt || lastMsg.createdAt || '';
                newNotifications.set(contactUser.id, {
                  contactId: contactUser.id,
                  unreadCount,
                  lastMessageTime
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching notifications for ${contactUser.id}:`, error);
          }
        })
      );

      setNotifications(newNotifications);
      setTotalUnread(calculateTotalUnread(newNotifications));
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  }, [user?.id, calculateTotalUnread]);

  useEffect(() => {
    if (user?.id) {
      refreshNotifications();
      updateIntervalRef.current = setInterval(refreshNotifications, 30000);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [user?.id, refreshNotifications]);

  return {
    notifications,
    totalUnread,
    updateNotification,
    clearNotification,
    refreshNotifications,
    getUnreadCount: (contactId: string) => notifications.get(contactId)?.unreadCount || 0
  };
};

