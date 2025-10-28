import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  username: string;
  createdAt: string;
  messageType?: 'text' | 'voice' | 'image' | 'video';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  replyToMessageId?: string | null;
  reactions?: Record<string, string[]>;
}

interface UseSignalRChatOptions {
  currentUserId?: string | null;
  token?: string;
  onMessageReceived?: (message: ChatMessage) => void;
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
    const base = 'http://localhost:5002/chat'; // Chat service URL
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

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Event handlers
      connection.on("ReceiveMessage", (message: ChatMessage) => {
        console.log('Message received:', message);
        onMessageReceived?.(message);
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
        
        if (error) {
          reconnect();
        }
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

      // Start connection
      await connection.start();
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
    connect,
    disconnect,
  };
}
