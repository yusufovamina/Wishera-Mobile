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
    // SignalR hub endpoint - use /chat (works based on logs showing successful connections)
    // The backend SignalR hub is at /chat, not /api/chat
    const base = `${chatServiceUrl}/chat`;
    const uid = currentUserId && currentUserId !== "" ? `userId=${encodeURIComponent(currentUserId)}` : "";
    const url = uid ? `${base}${base.includes("?") ? "&" : "?"}${uid}` : base;
    console.log('SignalR Hub URL:', url);
    return url;
  }, [currentUserId]);

  // Heartbeat mechanism to keep connection alive - disabled for now as it causes 404 errors
  // SignalR handles connection management internally
  const startHeartbeat = useCallback(() => {
    // Disable heartbeat - SignalR manages connection lifecycle
    return;
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
  // Note: reconnect is defined before connect to avoid circular dependency
  // We'll use a ref to store the connect function
  const connectRef = useRef<(() => Promise<void>) | null>(null);

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
      if (connectRef.current) {
        connectRef.current();
      }
    }, delay);
  }, [maxReconnectAttempts]);

  const isConnectingRef = useRef(false);

  const connect = useCallback(async () => {
    if (!currentUserId || !token) {
      console.log('Missing userId or token for SignalR connection');
      console.log('Current userId:', currentUserId);
      console.log('Token present:', !!token);
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('Connection already in progress, skipping...');
      return;
    }

    // If already connected, don't reconnect
    if (connectionRef.current && connectionRef.current.state === signalR.HubConnectionState.Connected) {
      console.log('Already connected, skipping connection attempt');
      return;
    }

    isConnectingRef.current = true;
    console.log('Attempting SignalR connection...');
    console.log('Hub URL:', hubUrl);
    console.log('Token length:', token?.length);

    try {
      // Clean up existing connection
      if (connectionRef.current) {
        try {
          await connectionRef.current.stop();
        } catch (stopError) {
          console.log('Error stopping existing connection:', stopError);
        }
        connectionRef.current = null;
      }

      // On web, prefer LongPolling to avoid browser/WebSocket constraints
      // For mobile, try WebSocket first, then fallback to LongPolling
      const preferLongPolling = Platform.OS === 'web';
      console.log('Platform:', Platform.OS, 'Prefer LongPolling:', preferLongPolling);

      let connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            console.log('Access token factory called, returning token');
            return token;
          },
          ...(preferLongPolling ? {
            // LongPolling requires negotiation, so don't skip it
            transport: signalR.HttpTransportType.LongPolling,
          } : {
            // Try WebSocket first with negotiation (let SignalR handle transport negotiation)
            // Don't use skipNegotiation unless we explicitly want WebSockets only
          })
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning) // Reduce logging noise
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

        const isCorsError = error?.message?.includes('access control checks') ||
          error?.message?.includes('Load failed') ||
          error?.message?.includes('CORS') ||
          String(error).includes('access control checks') ||
          String(error).includes('Load failed');

        if (isCorsError) {
          console.warn('CORS error detected - backend needs to allow CORS for SignalR endpoint');
          console.warn('Connection will not auto-reconnect until CORS is fixed');
          setConnectionState('CORS Error');
          return;
        }

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
        console.log('Starting SignalR connection...');
        await connection.start();
        console.log('SignalR connection started successfully');
      } catch (firstError: any) {
        // If WebSocket/SSE fails (common on iOS device or constrained env), force LongPolling as a fallback
        console.warn('Primary SignalR start failed, retrying with LongPolling...', firstError);
        console.warn('Error details:', firstError?.message, firstError?.response);

        // Try alternative hub URLs if /api/chat fails
        let alternativeHubUrl = hubUrl;
        const alternatives: string[] = [];

        if (hubUrl.includes('/api/chat')) {
          // Try /chat (without /api prefix) - this is the working endpoint
          alternatives.push(hubUrl.replace('/api/chat', '/chat'));
          // Try /api/chat/hub
          alternatives.push(hubUrl.replace('/api/chat', '/api/chat/hub'));
          // Try /chat/hub
          alternatives.push(hubUrl.replace('/api/chat', '/chat/hub'));
          // Try /hub
          alternatives.push(hubUrl.replace('/api/chat', '/hub'));
        } else if (hubUrl.includes('/chat')) {
          // Try /api/chat (though /chat seems to work)
          alternatives.push(hubUrl.replace('/chat', '/api/chat'));
          // Try /chat/hub
          alternatives.push(hubUrl.replace('/chat', '/chat/hub'));
          // Try /hub
          alternatives.push(hubUrl.replace('/chat', '/hub'));
        }

        // Use first alternative
        if (alternatives.length > 0) {
          alternativeHubUrl = alternatives[0];
          console.log('Trying alternative hub URL:', alternativeHubUrl);
          console.log('Other alternatives available:', alternatives.slice(1));
        }

        // Try each alternative URL until one works
        let fallbackSucceeded = false;
        const allAlternatives = [alternativeHubUrl, ...alternatives.slice(1)];

        for (const altUrl of allAlternatives) {
          try {
            console.log(`Trying hub URL: ${altUrl}`);
            // LongPolling fallback - must allow negotiation
            connection = new signalR.HubConnectionBuilder()
              .withUrl(altUrl, {
                accessTokenFactory: () => {
                  console.log('Access token factory called (fallback), returning token');
                  return token;
                },
                // LongPolling requires negotiation, so don't skip it
                transport: signalR.HttpTransportType.LongPolling,
              })
              .withAutomaticReconnect([0, 2000, 10000, 30000])
              .configureLogging(signalR.LogLevel.Warning)
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

              const isCorsError = error?.message?.includes('access control checks') ||
                error?.message?.includes('Load failed') ||
                error?.message?.includes('CORS') ||
                String(error).includes('access control checks') ||
                String(error).includes('Load failed');

              if (isCorsError) {
                console.warn('CORS error detected (LP) - backend needs to allow CORS');
                setConnectionState('CORS Error');
                return;
              }

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

            console.log(`Starting SignalR connection with LongPolling on ${altUrl}...`);
            await connection.start();
            console.log(`SignalR connection started successfully with LongPolling on ${altUrl}`);
            fallbackSucceeded = true;
            isConnectingRef.current = false;
            break; // Success! Exit the loop
          } catch (altError: any) {
            console.warn(`Failed to connect to ${altUrl}:`, altError?.message);
            // Check if it's a CORS error
            const isCorsError = altError?.message?.includes('access control checks') ||
              altError?.message?.includes('Load failed') ||
              altError?.message?.includes('CORS');
            if (isCorsError) {
              console.warn('CORS error on this URL - backend needs CORS configuration');
            }
            // Continue to next alternative
            continue;
          }
        }

        if (!fallbackSucceeded) {
          isConnectingRef.current = false;
          const fallbackError = new Error('All SignalR hub URL alternatives failed');
          console.error('SignalR fallback (LongPolling) failed for all alternatives');
          throw fallbackError;
        }
      }

      // Tune keepalive and server timeout for unstable local networks
      // 20s keepalive pings; 90s server timeout window
      (connection as any).keepAliveIntervalInMilliseconds = 20000;
      (connection as any).serverTimeoutInMilliseconds = 90000;
      console.log('SignalR connected successfully');
      console.log('Connection state:', connection.state);
      console.log('Connection ID:', connection.connectionId);

      connectionRef.current = connection;
      setConnected(true);
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      startHeartbeat();
      isConnectingRef.current = false;

    } catch (error: any) {
      console.error('SignalR connection failed:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      if (error?.response) {
        console.error('Error response:', error.response);
      }
      setConnected(false);
      setConnectionState('Failed');
      isConnectingRef.current = false;

      // Only reconnect if it's not a CORS error (CORS errors mean backend needs fixing)
      const isCorsError = error?.message?.includes('access control checks') ||
        error?.message?.includes('Load failed') ||
        error?.message?.includes('CORS');
      if (!isCorsError) {
        reconnect();
      } else {
        console.warn('CORS error detected - backend needs to allow CORS for SignalR endpoint');
        console.warn('Connection will not auto-reconnect until CORS is fixed');
      }
    }
  }, [currentUserId, token, hubUrl, onMessageReceived, onUserJoined, onUserLeft, onTypingStart, onTypingStop, reconnect, startHeartbeat, stopHeartbeat]);

  // Store connect function in ref for reconnect to use
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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
    console.log('[useSignalRChat] sendToUserWithMeta called:', { userId, message: message?.substring(0, 50), replyToMessageId, clientMessageId, connected });

    if (!connectionRef.current || !connected) {
      console.error('[useSignalRChat] SignalR not connected. connectionRef.current:', !!connectionRef.current, 'connected:', connected);
      return false;
    }

    try {
      console.log('[useSignalRChat] Invoking SendMessageToUserWithMeta on SignalR...');
      await connectionRef.current.invoke("SendMessageToUserWithMeta", userId, message, replyToMessageId ?? null, clientMessageId ?? null);
      console.log('[useSignalRChat] ✓ SendMessageToUserWithMeta invoked successfully');
      return true;
    } catch (error: any) {
      console.error('[useSignalRChat] ✗ Error sending message to user:', error);
      console.error('[useSignalRChat] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
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
      return () => { };
    }
    console.log('Registering ReceiveActiveUsers handler');
    // Try both case variations - backend might use different casing
    connectionRef.current.on("ReceiveActiveUsers", handler);
    connectionRef.current.on("receiveactiveusers", handler);
    return () => {
      console.log('Unregistering ReceiveActiveUsers handler');
      if (connectionRef.current) {
        connectionRef.current.off("ReceiveActiveUsers", handler);
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

  const onMessageDeleted = useCallback((handler: (data: { id: string }) => void) => {
    connectionRef.current?.on("MessageDeleted", handler as any);
    return () => connectionRef.current?.off("MessageDeleted", handler as any);
  }, []);

  const startTyping = useCallback(async (targetUserId: string) => {
    return connectionRef.current?.invoke("StartTyping", targetUserId);
  }, []);

  const stopTyping = useCallback(async (targetUserId: string) => {
    return connectionRef.current?.invoke("StopTyping", targetUserId);
  }, []);

  // React to message (toggles reaction - adds if not present, removes if present)
  const reactToMessage = useCallback(async (messageId: string, emoji: string) => {
    const connection = connectionRef.current;
    if (!connection) {
      console.error('SignalR not connected - no connection object');
      return false;
    }

    // Check actual connection state, not just the connected flag
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(`SignalR not connected - state: ${connection.state}`);
      // Try to reconnect
      if (connection.state === signalR.HubConnectionState.Disconnected) {
        try {
          await connection.start();
        } catch (reconnectError) {
          console.error('Failed to reconnect:', reconnectError);
        }
      }
      return false;
    }

    try {
      // First check if user already reacted - this will be handled by the UI
      // The backend ReactToMessage will add the reaction
      await connection.invoke("ReactToMessage", messageId, emoji);
      return true;
    } catch (error: any) {
      console.error('Error reacting to message:', error);
      // If connection was lost, try to reconnect
      if (error?.message?.includes('404') || error?.message?.includes('No Connection')) {
        console.log('Connection lost, attempting to reconnect...');
        setConnected(false);
        setConnectionState('Reconnecting');
        // The automatic reconnect should handle this
      }
      return false;
    }
  }, [connected]);

  // Unreact to message
  const unreactToMessage = useCallback(async (messageId: string, emoji: string) => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connection.invoke("UnreactToMessage", messageId, emoji);
      return true;
    } catch (error: any) {
      console.error('Error unreacting to message:', error);
      if (error?.message?.includes('404') || error?.message?.includes('No Connection')) {
        setConnected(false);
        setConnectionState('Reconnecting');
      }
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
    if (!connectionRef.current) {
      console.error('[useSignalRChat] DeleteMessage: connectionRef.current is null');
      return false;
    }

    if (connectionRef.current.state !== signalR.HubConnectionState.Connected) {
      console.error(`[useSignalRChat] DeleteMessage: SignalR not connected, state: ${connectionRef.current.state}`);
      // Try to reconnect
      if (connectionRef.current.state === signalR.HubConnectionState.Disconnected) {
        try {
          await connectionRef.current.start();
          console.log('[useSignalRChat] DeleteMessage: Reconnected to SignalR');
        } catch (reconnectError) {
          console.error('[useSignalRChat] DeleteMessage: Failed to reconnect:', reconnectError);
          return false;
        }
      } else {
        return false;
      }
    }

    try {
      console.log('[useSignalRChat] DeleteMessage: Invoking DeleteMessage with messageId:', messageId);
      const result = await connectionRef.current.invoke("DeleteMessage", messageId);
      console.log('[useSignalRChat] DeleteMessage: Result from server:', result);
      return result === true;
    } catch (error: any) {
      console.error('[useSignalRChat] DeleteMessage: Error:', error);
      console.error('[useSignalRChat] DeleteMessage: Error message:', error?.message);
      console.error('[useSignalRChat] DeleteMessage: Error stack:', error?.stack);
      if (error?.message?.includes('404') || error?.message?.includes('No Connection')) {
        setConnected(false);
        setConnectionState('Reconnecting');
      }
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

  // Call functionality
  const initiateCall = useCallback(async (calleeUserId: string, callType: 'audio' | 'video', callId?: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      const finalCallId = callId || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await connectionRef.current.invoke("InitiateCall", calleeUserId, callType, finalCallId);
      return true;
    } catch (error) {
      console.error('Error initiating call:', error);
      return false;
    }
  }, [connected]);

  const acceptCall = useCallback(async (callerUserId: string, callId: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("AcceptCall", callerUserId, callId);
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      return false;
    }
  }, [connected]);

  const rejectCall = useCallback(async (callerUserId: string, callId: string) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("RejectCall", callerUserId, callId);
      return true;
    } catch (error) {
      console.error('Error rejecting call:', error);
      return false;
    }
  }, [connected]);

  const endCall = useCallback(async (otherUserId: string, callId: string, duration?: number) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("EndCall", otherUserId, callId, duration);
      return true;
    } catch (error) {
      console.error('Error ending call:', error);
      return false;
    }
  }, [connected]);

  const sendCallSignal = useCallback(async (otherUserId: string, callId: string, signalType: string, signalData: any) => {
    if (!connectionRef.current || !connected) {
      console.error('SignalR not connected');
      return false;
    }
    try {
      await connectionRef.current.invoke("SendCallSignal", otherUserId, callId, signalType, signalData);
      return true;
    } catch (error) {
      console.error('Error sending call signal:', error);
      return false;
    }
  }, [connected]);

  // Call event handlers
  const onCallInitiated = useCallback((handler: (data: { callerUserId: string; calleeUserId: string; callType: string; callId: string; timestamp: string }) => void) => {
    connectionRef.current?.on("callinitiated", handler as any);
    return () => connectionRef.current?.off("callinitiated", handler as any);
  }, []);

  const onCallAccepted = useCallback((handler: (data: { callerUserId: string; calleeUserId: string; callId: string; timestamp: string }) => void) => {
    connectionRef.current?.on("callaccepted", handler as any);
    return () => connectionRef.current?.off("callaccepted", handler as any);
  }, []);

  const onCallRejected = useCallback((handler: (data: { callerUserId: string; calleeUserId: string; callId: string; timestamp: string }) => void) => {
    connectionRef.current?.on("callrejected", handler as any);
    return () => connectionRef.current?.off("callrejected", handler as any);
  }, []);

  const onCallEnded = useCallback((handler: (data: { callerUserId: string; calleeUserId: string; callId: string; timestamp: string }) => void) => {
    connectionRef.current?.on("callended", handler as any);
    return () => connectionRef.current?.off("callended", handler as any);
  }, []);

  const onCallSignal = useCallback((handler: (data: { callerUserId: string; calleeUserId: string; callId: string; signalType: string; signalData: any; timestamp: string }) => void) => {
    connectionRef.current?.on("callsignal", handler as any);
    return () => connectionRef.current?.off("callsignal", handler as any);
  }, []);

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

  // Initialize connection - only connect once when userId/token are available
  useEffect(() => {
    if (currentUserId && token) {
      // Small delay to prevent multiple simultaneous connections
      const timeoutId = setTimeout(() => {
        connect();
      }, 100);
      return () => {
        clearTimeout(timeoutId);
        disconnect();
      };
    } else {
      disconnect();
    }
  }, [currentUserId, token]); // Removed connect/disconnect from deps to prevent re-connections

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
    onMessageDeleted,
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
    // Call functionality
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendCallSignal,
    onCallInitiated,
    onCallAccepted,
    onCallRejected,
    onCallEnded,
    onCallSignal,
  };
}

