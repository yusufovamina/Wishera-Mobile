import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as signalR from '@microsoft/signalr';
import { chatServiceUrl } from '../api/client';

interface ChatMessage {
  id: string;
  messageId?: string;
  text: string;
  userId: string;
  senderId?: string;
  username: string;
  senderName?: string;
  createdAt: string;
  sentAt?: string;
  messageType?: 'text' | 'voice' | 'image' | 'video';
  customData?: {
    messageType?: string;
    audioUrl?: string;
    audioDuration?: number;
    imageUrl?: string;
    [key: string]: any;
  };
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  replyToMessageId?: string | null;
  clientMessageId?: string | null;
  reactions?: Record<string, string[]>;
  read?: boolean;
  readAt?: string;
  deliveredAt?: string;
}

interface UseSignalRChatOptions {
  currentUserId?: string | null;
  token?: string;
  onMessageReceived?: (payload: any, username?: string) => void;
  onUserJoined?: (userId: string, username: string) => void;
  onUserLeft?: (userId: string) => void;
  onTypingStart?: (userId: string, username: string) => void;
  onTypingStop?: (userId: string) => void;
}

export function useSignalRChat({
  currentUserId,
  token,
  onMessageReceived,
  onUserJoined,
  onUserLeft,
  onTypingStart,
  onTypingStop,
}: UseSignalRChatOptions) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const hubUrl = useMemo(() => {
    const base = `${chatServiceUrl}/chat`;
    const uid = currentUserId && currentUserId !== "" ? `userId=${encodeURIComponent(currentUserId)}` : "";
    return uid ? `${base}${base.includes("?") ? "&" : "?"}${uid}` : base;
  }, [currentUserId]);

  // Heartbeat mechanism to keep connection alive
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(async () => {
      const connection = connectionRef.current;
      if (connection && connection.state === signalR.HubConnectionState.Connected) {
        try {
          await connection.invoke("GetConnectionId");
        } catch (error) {
          console.warn('Heartbeat check failed:', error);
          setConnected(false);
          setConnectionState('Reconnecting');
        }
      }
    }, 30000); // Send heartbeat every 30 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Enhanced reconnection logic with exponential backoff
  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      setConnectionState('Failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
    
    setConnectionState('Reconnecting');
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [maxReconnectAttempts]);

  const connect = useCallback(async () => {
    if (!currentUserId || !token) {
      console.log('Missing userId or token for SignalR connection');
      return;
    }

    try {
      // Clean up existing connection
      if (connectionRef.current) {
        await connectionRef.current.stop();
      }

      // On web, prefer LongPolling to avoid browser/WebSocket constraints
      // For mobile, try WebSocket first, then fallback to LongPolling
      const preferLongPolling = Platform.OS === 'web';
      let connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, preferLongPolling ? {
          accessTokenFactory: () => token,
          // LongPolling requires negotiation, so don't skip it
          transport: signalR.HttpTransportType.LongPolling,
        } : {
          accessTokenFactory: () => token,
          // Try WebSocket first with negotiation (let SignalR handle transport negotiation)
          // Don't use skipNegotiation unless we explicitly want WebSockets only
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Event handlers (matching backend ChatHub events)
      connection.on("ReceiveMessage", (message: any, username?: string) => {
        console.log('Message received:', message, username);
        onMessageReceived?.(message, username);
      });

      // Backend also sends MessageEdited, MessageDeleted events
      connection.on("MessageEdited", (data: { id: string; text: string }) => {
        console.log('Message edited:', data);
        // Could trigger a callback here if needed
      });

      connection.on("MessageDeleted", (data: { id: string }) => {
        console.log('Message deleted:', data);
        // Could trigger a callback here if needed
      });

      connection.on("UserJoined", (userId: string, username: string) => {
        console.log('User joined:', userId, username);
        onUserJoined?.(userId, username);
      });

      connection.on("UserLeft", (userId: string) => {
        console.log('User left:', userId);
        onUserLeft?.(userId);
      });

      connection.on("UserTyping", (userId: string, username: string) => {
        console.log('User typing:', userId, username);
        onTypingStart?.(userId, username);
      });

      connection.on("UserStopTyping", (userId: string) => {
        console.log('User stop typing:', userId);
        onTypingStop?.(userId);
      });

      // Connection state handlers
      connection.onclose((error) => {
        console.log('SignalR connection closed:', error);
        setConnected(false);
        setConnectionState('Disconnected');
        stopHeartbeat();
        // Always attempt to reconnect, even without an explicit error
        reconnect();
      });

      connection.onreconnecting((error) => {
        console.log('SignalR reconnecting:', error);
        setConnectionState('Reconnecting');
        stopHeartbeat();
      });

      connection.onreconnected((connectionId) => {
        console.log('SignalR reconnected:', connectionId);
        setConnected(true);
        setConnectionState('Connected');
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
      });

      // Start connection (with negotiation + fallback handled by SignalR or explicit LP)
      try {
        await connection.start();
      } catch (firstError) {
        // If WebSocket/SSE fails (common on iOS device or constrained env), force LongPolling as a fallback
        console.warn('Primary SignalR start failed, retrying with LongPolling...', firstError);
        try {
          // LongPolling fallback - must allow negotiation
          connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
              accessTokenFactory: () => token,
              // LongPolling requires negotiation, so don't skip it
              transport: signalR.HttpTransportType.LongPolling,
            })
            .withAutomaticReconnect([0, 2000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

          // Re-register handlers on the new instance
          connection.on("ReceiveMessage", (message: any, username?: string) => {
            console.log('Message received:', message, username);
            onMessageReceived?.(message, username);
          });
          connection.on("MessageEdited", (data: { id: string; text: string }) => {
            console.log('Message edited:', data);
          });
          connection.on("MessageDeleted", (data: { id: string }) => {
            console.log('Message deleted:', data);
          });
          connection.on("UserJoined", (userId: string, username: string) => {
            console.log('User joined:', userId, username);
            onUserJoined?.(userId, username);
          });
          connection.on("UserLeft", (userId: string) => {
            console.log('User left:', userId);
            onUserLeft?.(userId);
          });
          connection.on("UserTyping", (userId: string, username: string) => {
            console.log('User typing:', userId, username);
            onTypingStart?.(userId, username);
          });
          connection.on("UserStopTyping", (userId: string) => {
            console.log('User stop typing:', userId);
            onTypingStop?.(userId);
          });

          connection.onclose((error) => {
            console.log('SignalR connection closed (LP):', error);
            setConnected(false);
            setConnectionState('Disconnected');
            stopHeartbeat();
            reconnect();
          });
          connection.onreconnecting((error) => {
            console.log('SignalR reconnecting (LP):', error);
            setConnectionState('Reconnecting');
            stopHeartbeat();
          });
          connection.onreconnected((connectionId) => {
            console.log('SignalR reconnected (LP):', connectionId);
            setConnected(true);
            setConnectionState('Connected');
            reconnectAttemptsRef.current = 0;
            startHeartbeat();
          });

          await connection.start();
        } catch (fallbackError) {
          console.error('SignalR fallback (LongPolling) failed:', fallbackError);
          throw fallbackError;
        }
      }

      // Tune keepalive and server timeout for unstable local networks
      // 20s keepalive pings; 90s server timeout window
      (connection as any).keepAliveIntervalInMilliseconds = 20000;
      (connection as any).serverTimeoutInMilliseconds = 90000;
      console.log('SignalR connected successfully');
      
      connectionRef.current = connection;
      setConnected(true);
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      startHeartbeat();

    } catch (error) {
      console.error('SignalR connection failed:', error);
      setConnected(false);
      setConnectionState('Failed');
      reconnect();
    }
  }, [currentUserId, token, hubUrl, onMessageReceived, onUserJoined, onUserLeft, onTypingStart, onTypingStop, reconnect, startHeartbeat, stopHeartbeat]);

  const disconnect = useCallback(async () => {
    stopHeartbeat();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
      } catch (error) {
        console.error('Error stopping SignalR connection:', error);
      }
      connectionRef.current = null;
    }
    
    setConnected(false);
    setConnectionState('Disconnected');
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  // Send message to user with metadata (matches front-end)
  const sendToUserWithMeta = useCallback(async (userId: string, message: string, replyToMessageId?: string | null, clientMessageId?: string | null) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }

    try {
      await connectionRef.current.invoke("SendMessageToUserWithMeta", userId, message, replyToMessageId ?? null, clientMessageId ?? null);
      return true;
    } catch (error) {
      console.error('Error sending message to user:', error);
      return false;
    }
  }, [connected]);

  // Send message to user with custom data (for voice, images, etc.)
  const sendToUserWithCustomData = useCallback(async (userId: string, message: string, customData: Record<string, any>, replyToMessageId?: string | null, clientMessageId?: string | null) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }

    try {
      await connectionRef.current.invoke("SendMessageToUserWithCustomData", userId, message, customData, replyToMessageId ?? null, clientMessageId ?? null);
      return true;
    } catch (error) {
      console.error('Error sending custom message to user:', error);
      return false;
    }
  }, [connected]);

  // Legacy sendMessage method for backward compatibility
  const sendMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }

    try {
      await connectionRef.current.invoke("SendMessage", message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [connected]);

  // Join conversation
  const joinConversation = useCallback(async (conversationId: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }

    try {
      await connectionRef.current.invoke("JoinConversation", conversationId);
      return true;
    } catch (error) {
      console.error('Error joining conversation:', error);
      return false;
    }
  }, [connected]);

  // Leave conversation
  const leaveConversation = useCallback(async (conversationId: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }

    try {
      await connectionRef.current.invoke("LeaveConversation", conversationId);
      return true;
    } catch (error) {
      console.error('Error leaving conversation:', error);
      return false;
    }
  }, [connected]);

  // Event handlers (exactly like front-end)
  const onReceiveMessage = useCallback((handler: (payload: any, username?: string) => void) => {
    connectionRef.current?.on("ReceiveMessage", handler);
    return () => connectionRef.current?.off("ReceiveMessage", handler);
  }, []);

  const onReceiveActiveUsers = useCallback((handler: (ids: string[]) => void) => {
    if (!connectionRef.current) {
      console.log('No connection available for ReceiveActiveUsers handler');
      return () => {};
    }
    console.log('Registering ReceiveActiveUsers handler');
    connectionRef.current.on("receiveactiveusers", handler);
    return () => {
      console.log('Unregistering ReceiveActiveUsers handler');
      if (connectionRef.current) {
        connectionRef.current.off("receiveactiveusers", handler);
      }
    };
  }, []);

  const onTyping = useCallback((handler: (data: { userId: string; isTyping: boolean }) => void) => {
    connectionRef.current?.on("Typing", handler as any);
    return () => connectionRef.current?.off("Typing", handler as any);
  }, []);

  const onMessagesRead = useCallback((handler: (data: { byUserId: string; messageIds: string[] }) => void) => {
    connectionRef.current?.on("MessagesRead", handler as any);
    return () => connectionRef.current?.off("MessagesRead", handler as any);
  }, []);

  const onMessageReactionUpdated = useCallback((handler: (data: { id: string; userId: string; emoji: string; removed?: boolean }) => void) => {
    connectionRef.current?.on("MessageReactionUpdated", handler as any);
    return () => connectionRef.current?.off("MessageReactionUpdated", handler as any);
  }, []);

  const startTyping = useCallback(async (targetUserId: string) => {
    return connectionRef.current?.invoke("StartTyping", targetUserId);
  }, []);

  const stopTyping = useCallback(async (targetUserId: string) => {
    return connectionRef.current?.invoke("StopTyping", targetUserId);
  }, []);

  // React to message
  const reactToMessage = useCallback(async (messageId: string, emoji: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("ReactToMessage", messageId, emoji);
      return true;
    } catch (error) {
      console.error('Error reacting to message:', error);
      return false;
    }
  }, [connected]);

  // Unreact to message
  const unreactToMessage = useCallback(async (messageId: string, emoji: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("UnreactToMessage", messageId, emoji);
      return true;
    } catch (error) {
      console.error('Error unreacting to message:', error);
      return false;
    }
  }, [connected]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("EditMessage", messageId, newText);
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  }, [connected]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("DeleteMessage", messageId);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }, [connected]);

  // Mark messages as read
  const markMessagesRead = useCallback(async (peerUserId: string, messageIds: string[]) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return 0;
    }
    try {
      const count = await connectionRef.current.invoke<number>("MarkMessagesRead", peerUserId, messageIds);
      return count;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return 0;
    }
  }, [connected]);

  // Get connection ID
  const getConnectionId = useCallback(async () => {
    if (!connectionRef.current || !connected) {
      return null;
    }
    try {
      const id = await connectionRef.current.invoke<string>("GetConnectionId");
      return id;
    } catch (error) {
      console.error('Error getting connection ID:', error);
      return null;
    }
  }, [connected]);

  // Add user (for active users tracking)
  const addUser = useCallback(async (userId: string, connectionId: string) => {
    if (!connectionRef.current || !connected) {
      return false;
    }
    try {
      await connectionRef.current.invoke("AddUser", userId, connectionId);
      return true;
    } catch (error) {
      console.error('Error adding user:', error);
      return false;
    }
  }, [connected]);

  // Initialize connection
  useEffect(() => {
    if (currentUserId && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [currentUserId, token, connect, disconnect]);

  return {
    connected,
    connectionState,
    sendMessage,
    sendToUserWithMeta,
    sendToUserWithCustomData,
    joinConversation,
    leaveConversation,
    onReceiveMessage,
    onReceiveActiveUsers,
    onTyping,
    onMessagesRead,
    onMessageReactionUpdated,
    startTyping,
    stopTyping,
    reactToMessage,
    unreactToMessage,
    editMessage,
    deleteMessage,
    markMessagesRead,
    getConnectionId,
    addUser,
    connect,
    disconnect,
  };
}
