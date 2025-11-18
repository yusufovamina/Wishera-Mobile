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
  const signalRHandlersRef = useRef<{ onMessageReceived?: (payload: any) => void; onMessagesRead?: (data: { byUserId: string; messageIds: string[] }) => void }>({});

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

  // Update notification for a specific contact (called when message is received or marked as read)
  const updateContactUnreadCount = useCallback(async (contactId: string) => {
    if (!user?.id) return;
    
    try {
      const historyResponse = await chatApi.get(endpoints.chatHistory(user.id, contactId, 1, 50));
      const messages = Array.isArray(historyResponse.data) 
        ? historyResponse.data 
        : (historyResponse.data?.items || historyResponse.data?.data || []);

      if (messages.length > 0) {
        // Only count messages from other user that are NOT read (read !== true)
        const unreadCount = messages.filter((m: any) => {
          const senderId = m.userId || m.senderId || m.fromUserId;
          const isFromOtherUser = senderId !== user.id;
          // Message is unread if read field is not explicitly true
          const readStatus = m.read === true || m.isRead === true;
          return isFromOtherUser && !readStatus;
        }).length;

        const lastMsg = messages[0];
        const lastMessageTime = lastMsg.sentAt || lastMsg.createdAt || '';
        
        setNotifications(prev => {
          const updated = new Map(prev);
          if (unreadCount > 0) {
            updated.set(contactId, {
              contactId,
              unreadCount,
              lastMessageTime
            });
          } else {
            updated.delete(contactId);
          }
          setTotalUnread(calculateTotalUnread(updated));
          return updated;
        });
      } else {
        // No messages, remove notification
        setNotifications(prev => {
          const updated = new Map(prev);
          updated.delete(contactId);
          setTotalUnread(calculateTotalUnread(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error(`Error updating notification for ${contactId}:`, error);
    }
  }, [user?.id, calculateTotalUnread]);

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
              // Only count messages from other user that are NOT read (read !== true)
              const unreadCount = messages.filter((m: any) => {
                const senderId = m.userId || m.senderId || m.fromUserId;
                const isFromOtherUser = senderId !== user.id;
                // Message is unread if read field is not explicitly true
                const readStatus = m.read === true || m.isRead === true;
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

  // Setup SignalR listeners for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    // Dynamically import useSignalRChat to avoid circular dependencies
    // We'll set up listeners when SignalR is available
    const setupSignalRListeners = async () => {
      try {
        const { useSignalRChat } = await import('../hooks/useSignalRChat');
        const { useAuthStore } = await import('../state/auth');
        const { token } = useAuthStore.getState();
        
        // Note: We can't directly use the hook here, so we'll expose handlers
        // that ChatScreen can register
        console.log('[useChatNotifications] SignalR setup ready');
      } catch (error) {
        console.error('[useChatNotifications] Error setting up SignalR:', error);
      }
    };

    setupSignalRListeners();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      refreshNotifications();
      // Reduce interval to 10 seconds for more responsive updates
      updateIntervalRef.current = setInterval(refreshNotifications, 10000);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [user?.id, refreshNotifications]);

  // Register SignalR handlers (called from ChatScreen)
  const registerSignalRHandlers = useCallback((
    onMessageReceived: (payload: any) => void,
    onMessagesRead: (data: { byUserId: string; messageIds: string[] }) => void
  ) => {
    signalRHandlersRef.current.onMessageReceived = (payload: any) => {
      // When a new message is received, update the notification for that contact
      const senderId = typeof payload === 'object' ? (payload.senderId || payload.userId) : null;
      if (senderId && senderId !== user?.id) {
        // Update notification count for this contact
        updateContactUnreadCount(senderId);
      }
      // Call the original handler
      onMessageReceived(payload);
    };

    signalRHandlersRef.current.onMessagesRead = (data: { byUserId: string; messageIds: string[] }) => {
      // When messages are marked as read, update notifications
      // The byUserId is the user who read the messages, so we need to find the contact
      // We'll refresh notifications to get accurate counts
      refreshNotifications();
      // Call the original handler
      onMessagesRead(data);
    };
  }, [user?.id, updateContactUnreadCount, refreshNotifications]);

  return {
    notifications,
    totalUnread,
    updateNotification,
    clearNotification,
    refreshNotifications,
    updateContactUnreadCount,
    registerSignalRHandlers,
    getUnreadCount: (contactId: string) => notifications.get(contactId)?.unreadCount || 0
  };
};

