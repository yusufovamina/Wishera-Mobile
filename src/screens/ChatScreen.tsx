import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, Alert, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { userApi, chatApi, endpoints, chatServiceUrl } from '../api/client';
import { useAuthStore } from '../state/auth';
import { useSignalRChat } from '../hooks/useSignalRChat';
import { useWebRTC } from '../hooks/useWebRTC';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import * as FileSystem from 'expo-file-system';

interface ChatContact {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isFollowing?: boolean;
}

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
  read?: boolean;
}

export const ChatScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);

  // Animated recording waveform component (needs access to styles)
  const AnimatedRecordingWaveform: React.FC<{ isRecording: boolean }> = ({ isRecording }) => {
    const [heights, setHeights] = React.useState<number[]>(Array(30).fill(15));
    const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
      if (isRecording) {
        intervalRef.current = setInterval(() => {
          setHeights(prev => prev.map(() => 10 + Math.random() * 30));
        }, 150);
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setHeights(Array(30).fill(15));
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [isRecording]);

    return (
      <View style={styles.recordingWaveform}>
        {heights.map((height, index) => (
          <View
            key={index}
            style={[
              styles.recordingWaveformBar,
              {
                height,
                backgroundColor: 'white',
                opacity: 0.8,
              },
            ]}
          />
        ))}
      </View>
    );
  };
  // State management exactly like front-end
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [showContacts, setShowContacts] = useState(true);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeoutRef, setTypingTimeoutRef] = useState<NodeJS.Timeout | null>(null);
  const { user, token } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const restoredOnceRef = useRef(false);

  // Get current conversation messages (exactly like front-end)
  const currentMessages = currentConversationId ? conversations[currentConversationId] || [] : [];

  // Helper functions for conversation management (exactly like front-end)
  const getConversationId = (contactId: string) => {
    if (!user?.id || !contactId) return '';
    // Use the same format as backend: string.CompareOrdinal(a, b) < 0 ? a:b : b:a
    // JavaScript string comparison (< operator) matches C# string.CompareOrdinal for simple strings
    const a = user.id.trim();
    const b = contactId.trim();
    // Compare strings lexicographically (same as C# CompareOrdinal)
    const conversationId = a < b ? `${a}:${b}` : `${b}:${a}`;
    console.log('[ChatScreen] Generated conversation ID:', { user: user.id, contact: contactId, conversationId, comparison: `${a} < ${b} = ${a < b}` });
    return conversationId;
  };

  const updateConversationMessages = (conversationId: string, messages: ChatMessage[]) => {
    setConversations(prev => ({
      ...prev,
      [conversationId]: messages
    }));
  };

  const addMessageToConversation = (conversationId: string, message: ChatMessage) => {
    setConversations(prev => {
      const currentMessages = prev[conversationId] || [];
      const newMessages = [...currentMessages, message];
      return {
        ...prev,
        [conversationId]: newMessages
      };
    });
  };

  // Additional state for new features
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emojiMenuForId, setEmojiMenuForId] = useState<string | null>(null);
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);
  const REACTIONS = ["👍","❤️","😂","🎉","👏","😮","😢","🔥","✅","❌","👌","😁","🙏","🤔","😎","💖"];

  // Call state
  const [incomingCall, setIncomingCall] = useState<{ callerUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ otherUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Wallpaper state
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [wallpapers, setWallpapers] = useState<any[]>([]);
  const [currentWallpaper, setCurrentWallpaper] = useState<{ wallpaperId: string | null; wallpaperUrl: string | null; opacity: number } | null>(null);
  const [wallpaperOpacity, setWallpaperOpacity] = useState(0.25);

  // Voice recording state
  const {
    isRecording,
    recordingDuration,
    recordedUri,
    recordedDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useVoiceRecorder();
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [recordingCanceled, setRecordingCanceled] = useState(false);
  const recordingButtonRef = useRef<TouchableOpacity>(null);
  const recordButtonPressInRef = useRef(false);
  const recordButtonPressOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartedRef = useRef(false); // Track if we successfully started recording

  // SignalR hook for real-time messaging
  const {
    connected,
    connectionState,
    sendToUserWithMeta,
    sendToUserWithCustomData,
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
    onMessageDeleted,
    markMessagesRead,
    getConnectionId,
    addUser,
    connect: retryConnect,
    disconnect,
    // Call functionality
    initiateCall,
    acceptCall,
    rejectCall,
    endCall: endCallSignalR,
    sendCallSignal,
    onCallInitiated,
    onCallAccepted,
    onCallRejected,
    onCallEnded,
    onCallSignal,
  } = useSignalRChat({
    currentUserId: user?.id || '',
    token: token || '',
    onMessageReceived: (payload: any, username?: string) => {
      const nowIso = new Date().toISOString();
      // Server sends either: (userId, messageText) or ({ senderId, text }, username)
      const text = typeof payload === 'string' ? payload : (payload?.text ?? payload?.message ?? '');
      const sender = typeof payload === 'string' ? (username || 'other') : (payload?.senderId || username || 'other');
      const id = typeof payload === 'object' && payload?.id ? String(payload.id) : Date.now().toString();
      const replyToMessageId = typeof payload === 'object' && payload?.replyToMessageId ? String(payload.replyToMessageId) : null;
      
      // Use server timestamp if available, otherwise use current time
      // Parse timestamp properly - handle both ISO strings and Date objects
      let serverTimestamp: string;
      if (typeof payload === 'object' && payload?.sentAt) {
        serverTimestamp = typeof payload.sentAt === 'string' 
        ? payload.sentAt 
          : new Date(payload.sentAt).toISOString();
      } else if (typeof payload === 'object' && payload?.createdAt) {
        serverTimestamp = typeof payload.createdAt === 'string'
        ? payload.createdAt 
          : new Date(payload.createdAt).toISOString();
      } else {
        serverTimestamp = new Date().toISOString();
      }
      
      // Extract custom data for voice messages
      const customData = typeof payload === 'object' ? payload?.customData : null;
      const messageType = customData?.messageType || 'text';
      const audioUrl = customData?.audioUrl;
      const audioDuration = customData?.audioDuration;
      
      // Log voice messages for debugging
      if (messageType === 'voice') {
        console.log('[ChatScreen] onMessageReceived - Voice message received:', {
          id,
          sender,
          audioUrl,
          audioDuration,
          hasAudioUrl: !!audioUrl,
          hasAudioDuration: audioDuration !== null && audioDuration !== undefined,
          customData: JSON.stringify(customData)
        });
      }

      const newMessage: ChatMessage = {
        id,
        text,
        userId: sender,
        username: username || 'Unknown',
        createdAt: serverTimestamp,
        replyToMessageId,
        messageType,
        ...(audioUrl && { audioUrl }),
        ...(audioDuration !== null && audioDuration !== undefined && { audioDuration })
      };

      // Check if this is a confirmation of a message we already sent (to prevent duplicates)
      const isOwnMessage = sender === user?.id;
      const clientMessageId = typeof payload === 'object' && payload?.clientMessageId ? payload.clientMessageId : null;
      
      // For messages sent by current user, try to update existing optimistic message or add it
      if (isOwnMessage && selectedContact?.id) {
        const targetConversationId = getConversationId(selectedContact.id);
        const conversation = conversations[targetConversationId];
        const existingMessage = conversation?.find(m => 
          m.id === id || (clientMessageId && m.id === clientMessageId)
        );
        
        if (existingMessage) {
          // Update existing optimistic message with server data
          if (messageType === 'voice') {
            console.log('[ChatScreen] Updating existing optimistic voice message with server data:', {
              clientMessageId,
              serverId: id,
              messageType,
              audioUrl,
              audioDuration,
              conversationId: targetConversationId
            });
          }
          
          setConversations(prev => {
            const updated = { ...prev };
            if (updated[targetConversationId]) {
              updated[targetConversationId] = updated[targetConversationId].map(m => {
                const isMatch = m.id === id || (clientMessageId && m.id === clientMessageId);
                if (isMatch) {
                  const updatedMessage = { 
                    ...m, 
                    id: id, // Use server ID
                    createdAt: serverTimestamp,
                    messageType: messageType || m.messageType || 'text',
                    ...(audioUrl && { audioUrl }),
                    ...(audioDuration !== null && audioDuration !== undefined && { audioDuration })
                  };
                  if (messageType === 'voice') {
                    console.log('[ChatScreen] ✅ Updated voice message with server data:', {
                      oldId: m.id,
                      newId: id,
                      messageType: updatedMessage.messageType,
                      audioUrl: updatedMessage.audioUrl,
                      audioDuration: updatedMessage.audioDuration
                    });
                  }
                  return updatedMessage;
                }
                return m;
              });
            } else {
              // Conversation doesn't exist, create it with the message
              console.log('[ChatScreen] Creating new conversation with message:', targetConversationId);
              updated[targetConversationId] = [newMessage];
            }
            return updated;
          });
        } else {
          // Message doesn't exist, add it (this handles SignalR confirmations)
          if (messageType === 'voice') {
            console.log('[ChatScreen] Adding new voice message to conversation:', {
              conversationId: targetConversationId,
              messageId: id,
              messageType,
              audioUrl,
              audioDuration
            });
          }
          addMessageToConversation(targetConversationId, newMessage);
        }
        
        // Update contact's last message and sort
        const lastMessagePreview = messageType === 'voice' ? '🎤 Voice message' : text;
        setContacts(prev => {
          const updated = prev.map(contact => 
            contact.id === selectedContact.id 
              ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
              : contact
          );
          return updated.sort((a, b) => {
            if (!a.lastMessageTime && !b.lastMessageTime) return 0;
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
        });
        
        // Don't process further - message is handled
        return;
      }

      // Determine which conversation this message belongs to
      // Extract recipient from payload if available (for sent messages)
      const recipientId = typeof payload === 'object' && payload?.recipientId 
        ? payload.recipientId 
        : (sender === user?.id ? selectedContact?.id : sender);
      
      if (sender === user?.id) {
        // Message sent by current user - find the recipient contact
        // Check if we have a clientMessageId that might help identify the conversation
        const targetContactId = recipientId || selectedContact?.id;
        if (targetContactId) {
          const targetConversationId = getConversationId(targetContactId);
          addMessageToConversation(targetConversationId, newMessage);
          
          // Update the contact's last message and time
          const lastMessagePreview = messageType === 'voice' ? '🎤 Voice message' : text;
          setContacts(prev => {
            const updated = prev.map(contact => 
              contact.id === targetContactId 
                ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
                : contact
            );
            // Sort contacts by last message time (most recent first)
            return updated.sort((a, b) => {
              if (!a.lastMessageTime && !b.lastMessageTime) return 0;
              if (!a.lastMessageTime) return 1;
              if (!b.lastMessageTime) return -1;
              return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
            });
          });
        }
      } else {
        // Message received from another user
        // If it's from the current selected contact, add to current conversation
        if (selectedContact && sender === selectedContact.id) {
          if (currentConversationId) {
            addMessageToConversation(currentConversationId, newMessage);
          }
        } else {
          // If it's from another contact, add to their conversation
          const senderConversationId = getConversationId(sender);
          addMessageToConversation(senderConversationId, newMessage);
        }
        
        // Update the contact's last message in the sidebar and move to top
        const lastMessagePreview = messageType === 'voice' ? '🎤 Voice message' : text;
        setContacts(prev => {
          const updated = prev.map(contact => 
            contact.id === sender 
              ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
              : contact
          );
          // Sort contacts by last message time (most recent first)
          return updated.sort((a, b) => {
            if (!a.lastMessageTime && !b.lastMessageTime) return 0;
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
        });
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onUserJoined: (userId: string, username: string) => {
      console.log('User joined:', username);
    },
    onUserLeft: (userId: string) => {
      console.log('User left:', userId);
    },
      onTypingStart: (userId: string, username: string) => {
        if (userId === selectedContact?.id) {
          setIsTyping(true);
        }
      },
      onTypingStop: (userId: string) => {
        if (userId === selectedContact?.id) {
          setIsTyping(false);
        }
      },
  });

  // WebRTC hook for actual call media
  const {
    localStream,
    remoteStream,
    getLocalStream,
    createPeerConnection,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    setIceCandidateCallback,
    toggleMute,
    toggleVideo,
    switchCamera,
    endCall: endWebRTCCall,
    isMuted,
    isVideoEnabled,
  } = useWebRTC();

  // Video components for web
  const RemoteVideoView = ({ stream, placeholderAvatar, placeholderName }: { stream: any | null; placeholderAvatar?: string; placeholderName: string }) => {
    const videoRef = useRef<any>(null);

    useEffect(() => {
      if (Platform.OS === 'web' && videoRef.current && stream) {
        videoRef.current.srcObject = stream as any;
        videoRef.current.play().catch(console.error);
      }
    }, [stream]);

    if (Platform.OS === 'web' && stream) {
      return (
        <View style={styles.remoteVideo}>
          {/* @ts-ignore - React Native Web supports video element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            autoPlay
            playsInline
          />
        </View>
      );
    }

    return (
      <View style={styles.remoteVideoPlaceholder}>
        {placeholderAvatar ? (
          <Image 
            source={{ uri: placeholderAvatar }}
            style={styles.activeCallAvatar}
          />
        ) : null}
        <Text style={styles.activeCallSubtitle}>
          {stream ? 'Video stream active' : placeholderName}
        </Text>
      </View>
    );
  };

  const LocalVideoView = ({ stream }: { stream: any | null }) => {
    const videoRef = useRef<any>(null);

    useEffect(() => {
      if (Platform.OS === 'web' && videoRef.current && stream) {
        videoRef.current.srcObject = stream as any;
        videoRef.current.play().catch(console.error);
      }
    }, [stream]);

    if (Platform.OS === 'web' && stream) {
      return (
        <View style={styles.localVideoContainer}>
          {/* @ts-ignore - React Native Web supports video element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror for self-view
            }}
            autoPlay
            playsInline
            muted
          />
        </View>
      );
    }

    return (
      <View style={styles.localVideoContainer}>
        <Text style={styles.activeCallSubtitle}>Local video</Text>
      </View>
    );
  };

  // Call handlers
  const handleStartCall = async (callType: 'audio' | 'video') => {
    if (!selectedContact?.id || !user?.id) {
      setError('Please select a contact to call');
      return;
    }
    
    if (!connected) {
      setError('Not connected. Please wait for connection...');
      return;
    }
    
    if (activeCall || incomingCall) {
      setError('Another call is already in progress');
      return;
    }
    
    try {
      // Get local media stream first
      await getLocalStream(callType === 'video');
      
      // Create peer connection
      createPeerConnection();
      
      // Set up ICE candidate callback
      setIceCandidateCallback(async (candidate) => {
        if (activeCall) {
          await sendCallSignal(selectedContact.id, activeCall.callId, 'ice-candidate', candidate);
        }
      });
      
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('[ChatScreen] Starting call:', { callType, callId, targetUserId: selectedContact.id });
      
      // Create WebRTC offer
      const offer = await createOffer();
      
      // Send call initiation via SignalR with offer
      const success = await initiateCall(selectedContact.id, callType, callId);
      if (success) {
        setActiveCall({ otherUserId: selectedContact.id, callType, callId });
        
        // Send WebRTC offer via SignalR
        await sendCallSignal(selectedContact.id, callId, 'offer', offer);
        
        // Start a timeout to auto-advance if call isn't accepted/rejected within 30 seconds
        setTimeout(() => {
          if (activeCall?.callId === callId && callDuration === 0) {
            console.log('[ChatScreen] Call timeout - no response from callee');
            handleEndCall();
          }
        }, 30000);
        console.log('[ChatScreen] Call initiated successfully');
      } else {
        endWebRTCCall();
        setError('Failed to start call. Please try again.');
      }
    } catch (error) {
      console.error('[ChatScreen] Error starting call:', error);
      endWebRTCCall();
      setError('Failed to start call. Please try again.');
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user?.id) return;
    
    try {
      // Get local media stream
      await getLocalStream(incomingCall.callType === 'video');
      
      // Create peer connection
      createPeerConnection();
      
      // Set up ICE candidate callback
      setIceCandidateCallback(async (candidate) => {
        if (activeCall) {
          await sendCallSignal(incomingCall.callerUserId, incomingCall.callId, 'ice-candidate', candidate);
        }
      });
      
      // Immediately update UI state - don't wait for SignalR response
      const callToAccept = { ...incomingCall };
      setActiveCall({ 
        otherUserId: callToAccept.callerUserId, 
        callType: callToAccept.callType, 
        callId: callToAccept.callId 
      });
      setIncomingCall(null);
      
      // Start call duration timer immediately
      setCallStartTime(new Date());
      setCallDuration(0);
      startCallDurationTimer();
      
      console.log('[ChatScreen] Accepting call:', callToAccept);
      const success = await acceptCall(callToAccept.callerUserId, callToAccept.callId);
      if (success) {
        console.log('[ChatScreen] Call accepted successfully via SignalR');
      } else {
        console.warn('[ChatScreen] AcceptCall returned false, but UI already updated');
      }
    } catch (error) {
      console.error('[ChatScreen] Error accepting call:', error);
      endWebRTCCall();
      setError('Failed to accept call. Please try again.');
    }
  };
  
  const startCallDurationTimer = useCallback(() => {
    // Clear any existing timer
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    
    console.log('[ChatScreen] Starting call duration timer');
    const startTime = new Date();
    setCallStartTime(startTime);
    setCallDuration(0);
    
    callDurationIntervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setCallDuration(diff);
    }, 1000);
  }, []);
  
  const stopCallDurationTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
  };
  
  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    try {
      console.log('[ChatScreen] Rejecting call:', incomingCall);
      await rejectCall(incomingCall.callerUserId, incomingCall.callId);
      setIncomingCall(null);
    } catch (error) {
      console.error('[ChatScreen] Error rejecting call:', error);
      setIncomingCall(null); // Clear state even if API call fails
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    try {
      console.log('[ChatScreen] Ending call:', activeCall);
      // End WebRTC call (cleanup media streams)
      endWebRTCCall();
      // End SignalR call signaling
      await endCallSignalR(activeCall.otherUserId, activeCall.callId);
      stopCallDurationTimer();
      setActiveCall(null);
      setCallStartTime(null);
      setCallDuration(0);
    } catch (error) {
      console.error('[ChatScreen] Error ending call:', error);
      // Clear state even if API call fails
      endWebRTCCall();
      stopCallDurationTimer();
      setActiveCall(null);
      setCallStartTime(null);
      setCallDuration(0);
    }
  };
  
  // Cleanup call timer on unmount or when call ends
  useEffect(() => {
    if (!activeCall) {
      stopCallDurationTimer();
      setCallStartTime(null);
      setCallDuration(0);
    }
    return () => {
      stopCallDurationTimer();
    };
  }, [activeCall]);

  // Subscribe to SignalR events for active users, reactions, and calls
  useEffect(() => {
    if (!connected) return;

    const offActiveUsers = onReceiveActiveUsers((ids: string[]) => {
      setActiveUserIds(ids);
      // Update contacts online status
      setContacts(prev => prev.map(contact => ({
        ...contact,
        isOnline: ids.includes(contact.id)
      })));
    });

    const offReactions = onMessageReactionUpdated(({ id: messageId, userId, emoji, removed }) => {
      // Update reactions in all conversations
      setConversations(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(conversationId => {
          updated[conversationId] = updated[conversationId].map(m => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            const current = new Set(reactions[emoji] || []);
            if (removed) {
              current.delete(userId);
            } else {
              current.add(userId);
            }
            reactions[emoji] = Array.from(current);
            return { ...m, reactions };
          });
        });
        return updated;
      });
    });

    const offMessageDeleted = onMessageDeleted(({ id: messageId }) => {
      // Remove deleted message from all conversations
      setConversations(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(conversationId => {
          updated[conversationId] = updated[conversationId].filter(m => m.id !== messageId);
        });
        return updated;
      });
    });

    const offRead = onMessagesRead(({ byUserId, messageIds }) => {
      // Could update UI to show read ticks per message id
      console.log('Messages read:', messageIds);
    });

    // Call event handlers
    const offCallInitiated = onCallInitiated((data) => {
      console.log('[ChatScreen] Call initiated event received:', data);
      console.log('[ChatScreen] Current user ID:', user?.id, 'Caller:', data.callerUserId, 'Callee:', data.calleeUserId);
      
      // If we're the caller, we already set activeCall in handleStartCall
      // If we're the callee, show incoming call
      if (data.calleeUserId === user?.id && data.callerUserId !== user?.id) {
        console.log('[ChatScreen] Incoming call from:', data.callerUserId);
        setIncomingCall({
          callerUserId: data.callerUserId,
          callType: data.callType as 'audio' | 'video',
          callId: data.callId
        });
        // Play notification sound/vibration here if needed
      } else if (data.callerUserId === user?.id) {
        console.log('[ChatScreen] Outgoing call confirmed to:', data.calleeUserId);
        // Call was initiated by us, make sure activeCall is set
        if (!activeCall || activeCall.callId !== data.callId) {
          setActiveCall({
            otherUserId: data.calleeUserId,
            callType: data.callType as 'audio' | 'video',
            callId: data.callId
          });
        }
      }
    });

    const offCallAccepted = onCallAccepted((data) => {
      console.log('[ChatScreen] Call accepted event received:', data);
      console.log('[ChatScreen] Current activeCall:', activeCall);
      console.log('[ChatScreen] Current user ID:', user?.id);
      
      // Update active call state
      if (data.callerUserId === user?.id || data.calleeUserId === user?.id) {
        const otherUserId = data.callerUserId === user?.id ? data.calleeUserId : data.callerUserId;
        const callType = activeCall?.callType || incomingCall?.callType || 'audio';
        
        console.log('[ChatScreen] Updating call state - otherUserId:', otherUserId, 'callType:', callType);
        
        // Only update if we don't already have an active call, or if it's a different call
        if (!activeCall || activeCall.callId !== data.callId) {
          setActiveCall({
            otherUserId,
            callType,
            callId: data.callId
          });
        }
        
        setIncomingCall(null);
        
        // Start call duration timer if not already started
        if (!callDurationIntervalRef.current) {
          console.log('[ChatScreen] Starting call duration timer from event');
          startCallDurationTimer();
        }
      } else {
        console.warn('[ChatScreen] Call accepted event for different users:', data);
      }
    });

    const offCallRejected = onCallRejected((data) => {
      console.log('[ChatScreen] Call rejected event:', data);
      stopCallDurationTimer();
      setActiveCall(null);
      setIncomingCall(null);
      setCallStartTime(null);
      setCallDuration(0);
      if (data.callerUserId === user?.id) {
        setError('Call was rejected');
        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    });

    const offCallEnded = onCallEnded((data) => {
      console.log('[ChatScreen] Call ended event:', data);
      stopCallDurationTimer();
      setActiveCall(null);
      setIncomingCall(null);
      setCallStartTime(null);
      setCallDuration(0);
    });

    const offCallSignal = onCallSignal(async (data) => {
      console.log('[ChatScreen] Call signal received:', data);
      // Handle WebRTC signaling (offer, answer, ice-candidate)
      if (!activeCall || activeCall.callId !== data.callId) return;
      
      try {
        if (data.signalType === 'offer') {
          // We're the callee - create answer
          const answer = await createAnswer(data.signalData);
          await sendCallSignal(data.callerUserId, data.callId, 'answer', answer);
        } else if (data.signalType === 'answer') {
          // We're the caller - set remote description
          await setRemoteDescription(data.signalData);
        } else if (data.signalType === 'ice-candidate') {
          // Add ICE candidate
          await addIceCandidate(data.signalData);
        }
      } catch (error) {
        console.error('[ChatScreen] Error handling call signal:', error);
      }
    });

    // Mark messages as read when viewing conversation
    const markCurrentMessagesRead = async () => {
      if (!selectedContact?.id || !user?.id || currentMessages.length === 0) return;
      try {
        const unreadMessageIds = currentMessages
          .filter(m => m.userId !== user.id && !m.read)
          .map(m => m.id);
        if (unreadMessageIds.length > 0) {
          await markMessagesRead(selectedContact.id, unreadMessageIds);
          // Update local state
          setConversations(prev => {
            const updated = { ...prev };
            if (currentConversationId && updated[currentConversationId]) {
              updated[currentConversationId] = updated[currentConversationId].map(m => 
                unreadMessageIds.includes(m.id) ? { ...m, read: true } : m
              );
            }
            return updated;
          });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    // Mark messages as read when conversation is opened
    if (selectedContact?.id && currentMessages.length > 0) {
      markCurrentMessagesRead();
    }

    // Register user for active tracking
    (async () => {
      try {
        const cid = await getConnectionId();
        if (cid && user?.id) {
          await addUser(user.id, cid);
        }
      } catch (error) {
        console.error('Failed to register user for active tracking:', error);
      }
    })();

    return () => {
      offActiveUsers?.();
      offReactions?.();
      offMessageDeleted?.();
      offRead?.();
      offCallInitiated?.();
      offCallAccepted?.();
      offCallRejected?.();
      offCallEnded?.();
      offCallSignal?.();
    };
  }, [connected, user?.id]); // Simplified dependencies to prevent re-registration

  useEffect(() => {
    fetchContacts();
    if (user?.id) {
      fetchWallpapers();
    }
  }, [user?.id]);

  const fetchContacts = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      // Get following users as contacts
      const response = await userApi.get(endpoints.getFollowing(user.id, 1, 50));
      const contactsData: ChatContact[] = response.data.map((user: any) => ({
        id: user.id,
        name: user.username,
        avatar: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`,
        lastMessage: "Start a conversation!",
        lastMessageTime: "",
        unreadCount: 0,
        isOnline: false,
        isFollowing: true
      }));
      
      // Sort contacts by last message time (most recent first), then alphabetically if no messages
      const sortedContacts = contactsData.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) {
          // Both have no messages, sort alphabetically
          return a.name.localeCompare(b.name);
        }
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      
      setContacts(sortedContacts);
    } catch (error) {
      console.log('Error fetching contacts:', error);
      // Fallback to empty array if API fails
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!user?.id) return;
    
    try {
      // Compute conversation ID before fetching (must match backend format)
      const conversationId = getConversationId(contactId);
      console.log('[ChatScreen] 📥 Fetching chat history for conversation:', conversationId, { 
        userId: user.id, 
        contactId 
      });
      
      // Load chat history from API
      const response = await chatApi.get(endpoints.chatHistory(user.id, contactId, 1, 50));
      console.log('[ChatScreen] Chat history API response:', {
        status: response.status,
        dataLength: Array.isArray(response.data) ? response.data.length : 0,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        conversationId
      });
      
      // Ensure response.data is an array
      const messagesArray = Array.isArray(response.data) ? response.data : [];
      console.log('[ChatScreen] Messages array length:', messagesArray.length, 'for conversation:', conversationId);
      
      const messagesData: ChatMessage[] = messagesArray.map((msg: any) => {
        console.log('Processing message:', msg);
        
        // Parse timestamp properly - prefer sentAt, then createdAt, then fallback
        let timestamp: string;
        if (msg.sentAt) {
          if (typeof msg.sentAt === 'string') {
            timestamp = msg.sentAt;
          } else {
            // It's a Date object or number
            timestamp = new Date(msg.sentAt).toISOString();
          }
        } else if (msg.createdAt) {
          if (typeof msg.createdAt === 'string') {
            timestamp = msg.createdAt;
          } else {
            timestamp = new Date(msg.createdAt).toISOString();
          }
        } else {
          timestamp = new Date().toISOString();
        }
        
        // Validate timestamp is valid
        const testDate = new Date(timestamp);
        if (isNaN(testDate.getTime())) {
          console.warn('Invalid timestamp for message:', msg.id, 'sentAt:', msg.sentAt, 'createdAt:', msg.createdAt, 'parsed:', timestamp);
          // Try to get a valid date from the raw values
          if (msg.sentAt && typeof msg.sentAt !== 'string') {
            timestamp = new Date(msg.sentAt).toISOString();
          } else if (msg.createdAt && typeof msg.createdAt !== 'string') {
            timestamp = new Date(msg.createdAt).toISOString();
          } else {
            timestamp = new Date().toISOString();
          }
        }
        
        // Log for debugging
        console.log('Message timestamp parsed:', {
          id: msg.id,
          rawSentAt: msg.sentAt,
          rawCreatedAt: msg.createdAt,
          finalTimestamp: timestamp,
          parsedDate: new Date(timestamp).toISOString()
        });
        
        // Log ALL message fields for debugging (especially voice messages)
        console.log('[ChatScreen] Processing message from API:', {
          id: msg.id,
          messageType: msg.messageType,
          audioUrl: msg.audioUrl,
          audioDuration: msg.audioDuration,
          text: msg.text || msg.message,
          userId: msg.userId || msg.senderId,
          hasMessageType: !!msg.messageType,
          hasAudioUrl: !!msg.audioUrl,
          hasAudioDuration: msg.audioDuration !== null && msg.audioDuration !== undefined,
          rawMsg: JSON.stringify(msg).substring(0, 200) // First 200 chars for debugging
        });
        
        // Extract voice message fields - check multiple possible field names
        const messageType = msg.messageType || (msg.customData?.messageType) || 'text';
        const audioUrl = msg.audioUrl || (msg.customData?.audioUrl) || null;
        const audioDuration = msg.audioDuration !== undefined && msg.audioDuration !== null 
          ? msg.audioDuration 
          : (msg.customData?.audioDuration !== undefined && msg.customData?.audioDuration !== null 
              ? msg.customData.audioDuration 
              : null);
        
        if (messageType === 'voice') {
          console.log('[ChatScreen] ✓ Voice message detected:', {
            id: msg.id,
            messageType,
            audioUrl,
            audioDuration,
            willBeDisplayed: !!(audioUrl && audioDuration)
          });
        }
        
        const message: ChatMessage = {
        id: msg.id,
        text: msg.text || msg.message || '',
        userId: msg.userId || msg.senderId,
        username: msg.username || msg.senderName || 'Unknown',
          createdAt: timestamp,
        messageType,
        audioUrl: audioUrl || undefined,
        audioDuration: audioDuration || undefined,
        imageUrl: msg.imageUrl || undefined,
        replyToMessageId: msg.replyToMessageId || undefined,
        reactions: msg.reactions || {},
        };
        
        return message;
      });
      
      // Sort messages by timestamp (ascending - oldest first)
      messagesData.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });
      
      console.log('[ChatScreen] Processed messages:', messagesData.length);
      console.log('[ChatScreen] Processed messages:', messagesData.map(m => ({
        id: m.id,
        type: m.messageType,
        hasAudioUrl: !!m.audioUrl,
        hasAudioDuration: m.audioDuration !== undefined && m.audioDuration !== null
      })));
      
      // Log voice messages separately for debugging
      const voiceMessages = messagesData.filter(m => m.messageType === 'voice');
      console.log('[ChatScreen] Voice messages in history:', voiceMessages.length);
      if (voiceMessages.length > 0) {
        voiceMessages.forEach((vm, idx) => {
          console.log(`[ChatScreen] Voice message ${idx + 1}:`, {
            id: vm.id,
            audioUrl: vm.audioUrl,
            audioDuration: vm.audioDuration,
            hasAudioUrl: !!vm.audioUrl,
            hasAudioDuration: vm.audioDuration !== null && vm.audioDuration !== undefined,
            willRender: !!(vm.audioUrl && vm.audioDuration)
          });
        });
      } else {
        console.log('[ChatScreen] ⚠️ No voice messages found in history!');
      }
      
      // Update conversation messages (conversationId was already computed at the start of the function)
      console.log('[ChatScreen] 📥 Received', messagesData.length, 'messages from API for conversation:', conversationId);
      updateConversationMessages(conversationId, messagesData);
      console.log('[ChatScreen] ✅ Updated conversation:', conversationId, 'with', messagesData.length, 'messages');
      
      // Verify voice messages are in the conversation
      const voiceMsgsInConversation = messagesData.filter(m => m.messageType === 'voice');
      if (voiceMsgsInConversation.length > 0) {
        console.log('[ChatScreen] ✅ Found', voiceMsgsInConversation.length, 'voice messages in conversation', conversationId);
        voiceMsgsInConversation.forEach((vm, idx) => {
          console.log(`[ChatScreen] Voice message ${idx + 1}:`, {
            id: vm.id,
            audioUrl: vm.audioUrl,
            audioDuration: vm.audioDuration,
            hasAudioUrl: !!vm.audioUrl,
            hasAudioDuration: vm.audioDuration !== null && vm.audioDuration !== undefined,
            willRender: !!(vm.audioUrl && vm.audioDuration)
          });
        });
      } else {
        console.log('[ChatScreen] ⚠️ No voice messages found in conversation', conversationId);
        console.log('[ChatScreen] All message types:', messagesData.map(m => m.messageType));
      }
      
      // Update contact's last message from fetched messages
      if (messagesData.length > 0) {
        const lastMessage = messagesData[messagesData.length - 1]; // Messages are sorted by time
        const lastMessagePreview = lastMessage.messageType === 'voice' ? '🎤 Voice message' : lastMessage.text;
        const lastMessageTime = lastMessage.createdAt;
        
        setContacts(prev => {
          const updated = prev.map(contact => 
            contact.id === contactId 
              ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: lastMessageTime }
              : contact
          );
          // Sort contacts by last message time (most recent first)
          return updated.sort((a, b) => {
            if (!a.lastMessageTime && !b.lastMessageTime) return 0;
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
        });
      }
    } catch (error: any) {
      console.log('Error fetching messages:', error);
      console.log('Error response:', error.response?.data);
      console.log('Error status:', error.response?.status);
      // Fallback to empty array if API fails
      const conversationId = getConversationId(contactId);
      updateConversationMessages(conversationId, []);
    }
  };

  // Fetch wallpapers
  const fetchWallpapers = async () => {
    if (!user?.id) return;
    try {
      const response = await chatApi.get(endpoints.getWallpaperCatalog(user.id));
      setWallpapers(response.data || []);
    } catch (error) {
      console.error('Error fetching wallpapers:', error);
    }
  };

  // Load current wallpaper preference
  const loadWallpaper = async (peerUserId: string) => {
    if (!user?.id || !peerUserId) return;
    try {
      const response = await chatApi.get(endpoints.getConversationWallpaper(user.id, peerUserId));
      setCurrentWallpaper({
        wallpaperId: response.data.wallpaperId,
        wallpaperUrl: response.data.wallpaperUrl,
        opacity: response.data.opacity || 0.25
      });
      setWallpaperOpacity(response.data.opacity || 0.25);
    } catch (error) {
      console.error('Error loading wallpaper:', error);
      setCurrentWallpaper(null);
    }
  };

  // Save wallpaper preference
  const saveWallpaper = async (wallpaperId: string | null, wallpaperUrl: string | null) => {
    if (!user?.id || !selectedContact?.id) return;
    try {
      await chatApi.post(endpoints.setConversationWallpaper, {
        me: user.id,
        peer: selectedContact.id,
        wallpaperId,
        wallpaperUrl,
        opacity: wallpaperOpacity
      });
      setCurrentWallpaper({
        wallpaperId,
        wallpaperUrl,
        opacity: wallpaperOpacity
      });
      setShowWallpaperPicker(false);
    } catch (error) {
      console.error('Error saving wallpaper:', error);
      setError('Failed to save wallpaper. Please try again.');
    }
  };

  const handleContactSelect = async (contact: ChatContact) => {
    setSelectedContact(contact);
    setShowContacts(false);
    
    const conversationId = getConversationId(contact.id);
    setCurrentConversationId(conversationId);
    
    // Load messages for this conversation
    await fetchMessages(contact.id);
    
    // Load wallpaper for this conversation
    await loadWallpaper(contact.id);
    
    // Mark messages as read after loading
    setTimeout(async () => {
      if (currentConversationId && user?.id && contact.id) {
        try {
          const unreadMessages = conversations[conversationId]?.filter(m => 
            m.userId !== user.id && !m.read
          ) || [];
          
          if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map(m => m.id);
            await markMessagesRead(contact.id, messageIds);
            
            // Update messages to mark as read locally
            setConversations(prev => ({
              ...prev,
              [conversationId]: prev[conversationId]?.map(m => 
                messageIds.includes(m.id) ? { ...m, read: true } : m
              ) || []
            }));
          }
        } catch (error) {
          console.error('Failed to mark messages as read:', error);
        }
      }
    }, 500);
  };

  const handleSendMessage = async () => {
    try {
      if (!inputText.trim() && !editingId) return;
      if (!user?.id) return;
      if (!connected) {
        setError('Connection lost. Please wait for reconnection...');
        return;
      }

      if (editingId) {
        // Edit existing message
        const newText = inputText.trim();
        setInputText("");
        setEditingId(null);
        
        // Optimistic update
        if (currentConversationId) {
          setConversations(prev => ({
            ...prev,
            [currentConversationId]: prev[currentConversationId]?.map(m => 
              m.id === editingId ? { ...m, text: newText } : m
            ) || []
          }));
        }
        
        try {
          await editMessage(editingId, newText);
          // Also try API endpoint as backup
          await chatApi.post(endpoints.editChatMessage, { messageId: editingId, newText });
        } catch (error) {
          console.error('Failed to edit message:', error);
          setError('Failed to edit message. Please try again.');
        }
        return;
      }
      
      await sendText(inputText.trim());
      setInputText('');
      setReplyTo(null);
    } catch (e: any) {
      console.error('Send message error:', e);
      setError(e?.message || 'Failed to send message');
    }
  };

  const uploadAudioFile = async (audioUri: string, duration: number): Promise<string | null> => {
    try {
      if (!user?.id || !selectedContact?.id) {
        console.error('Missing user or contact ID');
        return null;
      }

      // Create form data
      const formData = new FormData();
      const fileName = `voice_${Date.now()}.m4a`;
      const fileType = 'audio/m4a';

      // Handle blob URIs on web platform
      if (Platform.OS === 'web' && audioUri.startsWith('blob:')) {
        console.log('[ChatScreen] Converting blob URI to File for upload...');
        try {
          // Fetch the blob from the blob URI
          const response = await fetch(audioUri);
          const blob = await response.blob();
          
          // Create a File object from the blob
          const file = new File([blob], fileName, { type: fileType });
          formData.append('file', file);
        } catch (blobError: any) {
          console.error('[ChatScreen] Failed to convert blob to File:', blobError);
          // Fallback: try using the blob URI directly
          formData.append('file', audioUri);
        }
      } else {
        // On native platforms, use the URI directly
        // @ts-ignore - FormData typing issue
        formData.append('file', {
          uri: audioUri,
          name: fileName,
          type: fileType,
        } as any);
      }

      formData.append('messageType', 'voice');
      formData.append('duration', duration.toString());
      formData.append('userId', user.id);
      formData.append('recipientId', selectedContact.id);

      console.log('[ChatScreen] Uploading audio file:', { audioUri, duration, fileName, platform: Platform.OS });

      const response = await chatApi.post(endpoints.uploadChatMedia, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[ChatScreen] Audio upload response:', response.data);
      return response.data?.audioUrl || response.data?.url || null;
    } catch (error: any) {
      console.error('[ChatScreen] Failed to upload audio file:', error);
      console.error('[ChatScreen] Error details:', error.response?.data || error.message);
      return null;
    }
  };

  const sendVoiceMessage = async (audioUri: string, duration: number) => {
    try {
      console.log('[ChatScreen] sendVoiceMessage called:', { audioUri, duration, userId: user?.id, contactId: selectedContact?.id, connected });
      
      if (!user?.id || !selectedContact?.id || !connected) {
        console.error('Cannot send voice message: missing user, contact, or not connected');
        Alert.alert('Error', 'Cannot send voice message. Please check your connection.');
        return;
      }

      // Show uploading indicator
      const uploadingMessage: ChatMessage = {
        id: `uploading_${Date.now()}`,
        text: '🎤 Uploading voice message...',
        userId: user.id,
        username: user.username || 'You',
        createdAt: new Date().toISOString(),
        messageType: 'voice',
      };

      if (currentConversationId) {
        addMessageToConversation(currentConversationId, uploadingMessage);
      }

      // Upload audio file
      console.log('[ChatScreen] Uploading audio file...');
      const audioUrl = await uploadAudioFile(audioUri, duration);
      console.log('[ChatScreen] Audio upload result:', audioUrl);

      if (!audioUrl) {
        console.error('Failed to upload audio file');
        Alert.alert('Error', 'Failed to upload voice message. Please try again.');
        // Remove uploading message
        if (currentConversationId) {
          setConversations(prev => ({
            ...prev,
            [currentConversationId]: (prev[currentConversationId] || []).filter(m => m.id !== uploadingMessage.id),
          }));
        }
        return;
      }

      // Remove uploading message
      if (currentConversationId) {
        setConversations(prev => ({
          ...prev,
          [currentConversationId]: (prev[currentConversationId] || []).filter(m => m.id !== uploadingMessage.id),
        }));
      }

      // Send voice message via SignalR
      // Compute conversation ID to ensure it matches the one used for fetching
      const conversationIdForVoice = getConversationId(selectedContact.id);
      const clientMessageId = `voice_${Date.now()}`;
      const customData = {
        messageType: 'voice',
        audioUrl,
        audioDuration: duration,
      };

      console.log('[ChatScreen] 📤 Sending voice message via SignalR:', { 
        clientMessageId, 
        customData,
        conversationId: conversationIdForVoice,
        audioUrl,
        audioDuration: duration,
        userId: user.id,
        contactId: selectedContact.id,
        messageType: 'voice'
      });
      
      const success = await sendToUserWithCustomData(
        selectedContact.id,
        '🎤 Voice message',
        customData,
        replyTo?.id || null,
        clientMessageId
      );

      console.log('[ChatScreen] SignalR send result:', success);

      if (success) {
        // Add message to conversation optimistically
        // SignalR will send it back with the server ID, so we'll update it then
        const voiceMessage: ChatMessage = {
          id: clientMessageId,
          text: '🎤 Voice message',
          userId: user.id,
          username: user.username || 'You',
          createdAt: new Date().toISOString(),
          messageType: 'voice',
          audioUrl,
          audioDuration: duration,
          replyToMessageId: replyTo?.id || null,
        };

        console.log('[ChatScreen] Adding optimistic voice message:', {
          id: clientMessageId,
          audioUrl,
          audioDuration: duration,
          conversationId: conversationIdForVoice,
          messageType: 'voice'
        });

        // Use the computed conversation ID to ensure consistency
        if (conversationIdForVoice) {
          addMessageToConversation(conversationIdForVoice, voiceMessage);
          console.log('[ChatScreen] ✅ Optimistic voice message added to conversation:', conversationIdForVoice);
          console.log('[ChatScreen] ✅ Voice message will be saved to MongoDB via SignalR backend');
        } else {
          console.error('[ChatScreen] ⚠️ Could not compute conversation ID for voice message');
        }

        setReplyTo(null);
        clearRecording();
        console.log('[ChatScreen] ✅ Voice message sent successfully and saved optimistically');
      } else {
        console.error('[ChatScreen] ❌ Failed to send voice message via SignalR');
        Alert.alert('Error', 'Failed to send voice message. Please try again.');
      }
    } catch (error: any) {
      console.error('[ChatScreen] Error sending voice message:', error);
      Alert.alert('Error', error?.message || 'Failed to send voice message. Please try again.');
    }
  };

  // Voice recording handlers
  const handleRecordPressIn = async () => {
    console.log('[ChatScreen] handleRecordPressIn called', { 
      isRecording, 
      isRecordingMode, 
      recordedUri,
      recordingStartedRef: recordingStartedRef.current 
    });
    
    // Prevent starting a new recording if one is already in progress
    // Check both isRecording state and the ref to handle stale state
    if (isRecording && recordingStartedRef.current) {
      console.warn('[ChatScreen] Already recording (isRecording=true and recordingStartedRef=true), ignoring press');
      return;
    }
    
    // If recording state says we're recording but ref says we're not, clean up
    if (isRecording && !recordingStartedRef.current) {
      console.warn('[ChatScreen] Stale recording state detected, cleaning up...');
      try {
        await cancelRecording();
      } catch (error) {
        console.error('[ChatScreen] Error cleaning up stale recording:', error);
      }
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // If we have a recorded URI but are not recording, clear it first
    if (recordedUri && !isRecording && !recordingStartedRef.current) {
      console.log('[ChatScreen] Clearing previous recording before starting new one');
      clearRecording();
    }
    
    if (!selectedContact?.id || !connected) {
      Alert.alert('Error', 'Cannot record. Please select a contact and ensure you are connected.');
      return;
    }

    recordButtonPressInRef.current = true;
    recordingStartedRef.current = false; // Reset flag
    setRecordingCanceled(false);
    
    // Set recording mode immediately (optimistic UI update)
    // This shows the UI right away - CRITICAL for Telegram-style UX
    setIsRecordingMode(true);
    console.log('[ChatScreen] Recording mode set to true (optimistic)');
    
    // Start recording (this is async, but UI is already showing)
    console.log('[ChatScreen] Starting recording...');
    
    try {
      const started = await startRecording();
      console.log('[ChatScreen] Recording started:', started);
      
      if (!started) {
        // Recording failed to start
        console.error('[ChatScreen] Failed to start recording');
        recordingStartedRef.current = false;
        setIsRecordingMode(false);
        recordButtonPressInRef.current = false;
        Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
        return;
      }
      
      // Recording started successfully - mark it in ref
      recordingStartedRef.current = true;
      console.log('[ChatScreen] Recording start confirmed, ref set to true');
      
      // Explicitly ensure recording mode stays true after successful start
      // This prevents any race conditions where handleRecordPressOut might check before this completes
      setIsRecordingMode(true);
      console.log('[ChatScreen] Recording mode explicitly set to true after successful start');
    } catch (error) {
      console.error('[ChatScreen] Error starting recording:', error);
      recordingStartedRef.current = false;
      setIsRecordingMode(false);
      recordButtonPressInRef.current = false;
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const handleRecordPressOut = async () => {
    console.log('[ChatScreen] handleRecordPressOut called', {
      isRecordingMode,
      recordingCanceled,
      recordingStartedRef: recordingStartedRef.current,
      isRecording
    });
    
    // Telegram-style behavior: Don't stop recording when button is released
    // The recording continues until user cancels or sends
    
    // IMPORTANT: Do NOT modify isRecordingMode here - just return immediately
    // It was set optimistically in handleRecordPressIn and should stay active
    // The UI will remain visible until user cancels or sends
    
    // If recording was canceled, don't do anything (cancel handler will clean up)
    if (recordingCanceled) {
      console.log('[ChatScreen] Recording was canceled, ignoring press out');
      return;
    }
    
    // Do absolutely nothing - just return
    // Don't check anything, don't update any state
    // Recording mode is already active and should stay active
    console.log('[ChatScreen] Recording continues (Telegram-style), UI stays visible');
    return;
  };

  const handleRecordCancel = async () => {
    console.log('[ChatScreen] handleRecordCancel called', { isRecording, isRecordingMode });
    setRecordingCanceled(true);
    
    // Stop and cancel recording
    if (isRecording || recordingStartedRef.current) {
      console.log('[ChatScreen] Canceling recording...');
      await cancelRecording();
      recordingStartedRef.current = false;
    } else if (recordedUri) {
      // Clear any recorded audio
      clearRecording();
    }
    
    setIsRecordingMode(false);
    setRecordingCanceled(false);
    recordButtonPressInRef.current = false;
    console.log('[ChatScreen] Recording canceled');
  };

  const handleSendRecording = async () => {
    console.log('[ChatScreen] handleSendRecording called', { isRecording, recordedUri, recordedDuration });
    
    // If still recording, stop first
    if (isRecording) {
      console.log('[ChatScreen] Stopping recording before sending...');
      const recordingResult = await stopRecording();
      console.log('[ChatScreen] Recording stopped:', recordingResult);
      
      if (recordingResult && recordingResult.uri && recordingResult.duration > 0) {
        // Minimum recording duration (like Telegram - 1 second)
        if (recordingResult.duration < 1) {
          console.log('[ChatScreen] Recording too short');
          Alert.alert('Too Short', 'Voice message must be at least 1 second long.');
          await cancelRecording();
          setIsRecordingMode(false);
          setRecordingCanceled(false);
          return;
        }

        // Send voice message
        console.log('[ChatScreen] Sending voice message...');
        await sendVoiceMessage(recordingResult.uri, recordingResult.duration);
        setIsRecordingMode(false);
        setRecordingCanceled(false);
        recordingStartedRef.current = false;
        recordButtonPressInRef.current = false;
      } else {
        console.log('[ChatScreen] No valid recording to send');
        Alert.alert('Error', 'No recording to send.');
        setIsRecordingMode(false);
        setRecordingCanceled(false);
        recordingStartedRef.current = false;
        recordButtonPressInRef.current = false;
      }
    } else if (recordedUri && recordedDuration > 0) {
      // Already recorded, send it
      console.log('[ChatScreen] Sending existing recording...', { recordedUri, recordedDuration });
      await sendVoiceMessage(recordedUri, recordedDuration);
      clearRecording();
      setIsRecordingMode(false);
      setRecordingCanceled(false);
      recordingStartedRef.current = false;
      recordButtonPressInRef.current = false;
    } else {
      console.log('[ChatScreen] No recording available to send', { isRecording, recordedUri, recordedDuration });
      Alert.alert('Error', 'No recording to send.');
      setIsRecordingMode(false);
      setRecordingCanceled(false);
      recordingStartedRef.current = false;
      recordButtonPressInRef.current = false;
    }
  };

  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendText = async (text: string) => {
    console.log('[ChatScreen] sendText called:', { text: text?.substring(0, 50), userId: user?.id, connected, selectedContactId: selectedContact?.id });
    
    if (!text.trim()) {
      console.log('[ChatScreen] Text is empty, returning');
      return;
    }
    if (!user?.id) {
      console.log('[ChatScreen] User ID is missing, returning');
      return;
    }
    if (!connected) {
      console.error('[ChatScreen] SignalR not connected');
      setError('Connection lost. Please wait for reconnection...');
      return;
    }
    
    const id = Date.now().toString();
    const newMessage: ChatMessage = {
      id,
      text: text.trim(),
      userId: user.id,
      username: user.username || 'You',
      createdAt: new Date().toISOString(),
      messageType: 'text',
      replyToMessageId: replyTo?.id ?? null,
    };
    
    console.log('[ChatScreen] Created message object:', { id, text: newMessage.text, userId: newMessage.userId });
    
    if (currentConversationId) {
      console.log('[ChatScreen] Adding message to conversation:', currentConversationId);
      addMessageToConversation(currentConversationId, newMessage);
    }
    
    if (selectedContact) {
      const targetId = selectedContact.id;
      console.log('[ChatScreen] Sending message to contact:', { targetId, contactName: selectedContact.name });
      if (targetId && typeof targetId === 'string') {
        const result = await sendToUserWithMeta(targetId, newMessage.text, replyTo?.id ?? undefined, id);
        console.log('[ChatScreen] sendToUserWithMeta result:', result);
        if (!result) {
          setError('Failed to send message. Please try again.');
        }
      } else {
        console.error('[ChatScreen] Invalid target user id:', targetId);
        throw new Error('Invalid target user id');
      }
    } else {
      console.error('[ChatScreen] No selected contact');
    }
  };

  // Handler for reacting to messages (toggles reaction)
  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!user?.id) {
      console.error('Cannot react: user ID is missing');
      return;
    }
    
    try {
      // Check if user already reacted to this message with this emoji
      const message = currentMessages.find(m => m.id === messageId);
      const hasReacted = message?.reactions?.[emoji]?.includes(user.id);
      
      console.log('[ChatScreen] handleReactToMessage:', { 
        messageId, 
        emoji, 
        hasReacted, 
        currentReactions: message?.reactions,
        userId: user.id 
      });
      
      if (hasReacted) {
        // Remove reaction
        console.log('[ChatScreen] Removing reaction');
        const result = await unreactToMessage(messageId, emoji);
        console.log('[ChatScreen] Unreact result:', result);
      } else {
        // Add reaction
        console.log('[ChatScreen] Adding reaction');
        const result = await reactToMessage(messageId, emoji);
        console.log('[ChatScreen] React result:', result);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to react to message:', error);
      setError('Failed to react to message. Please try again.');
    }
    setEmojiMenuForId(null);
  };

  // Handler for deleting messages
  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ChatScreen] Deleting message:', messageId);
              
              // Try SignalR deletion first
              const success = await deleteMessage(messageId);
              console.log('[ChatScreen] DeleteMessage SignalR result:', success);
              
              if (success) {
                // Remove from local state immediately for better UX
                // The SignalR event will also remove it, but this gives instant feedback
                if (currentConversationId) {
                  setConversations(prev => {
                    const updated = { ...prev };
                    if (updated[currentConversationId]) {
                      updated[currentConversationId] = updated[currentConversationId].filter(m => m.id !== messageId);
                    }
                    return updated;
                  });
                }
                console.log('[ChatScreen] Message deleted successfully');
              } else {
                // If SignalR deletion failed, try HTTP endpoint as fallback
                console.log('[ChatScreen] SignalR deletion failed, trying HTTP endpoint');
                try {
                  await chatApi.post(endpoints.deleteChatMessage, { messageId });
              // Remove from local state
              if (currentConversationId) {
                    setConversations(prev => {
                      const updated = { ...prev };
                      if (updated[currentConversationId]) {
                        updated[currentConversationId] = updated[currentConversationId].filter(m => m.id !== messageId);
                      }
                      return updated;
                    });
                  }
                  console.log('[ChatScreen] Message deleted via HTTP endpoint');
                } catch (httpError) {
                  console.error('[ChatScreen] HTTP deletion also failed:', httpError);
                  setError('Failed to delete message. Please try again.');
                }
              }
            } catch (error) {
              console.error('[ChatScreen] Failed to delete message:', error);
              setError('Failed to delete message. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleTyping = async () => {
    if (selectedContact?.id && connected) {
      await startTyping(selectedContact.id);
      if (typingTimeoutRef) clearTimeout(typingTimeoutRef);
      const timeout = setTimeout(() => {
        if (selectedContact?.id) stopTyping(selectedContact.id);
      }, 1200);
      setTypingTimeoutRef(timeout);
    }
  };

  const handleStopTyping = async () => {
    if (selectedContact?.id && connected) {
      await stopTyping(selectedContact.id);
    }
  };

  const renderContact = ({ item }: { item: ChatContact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleContactSelect(item)}
    >
      <View style={styles.contactAvatar}>
        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.lastMessageTime}>{item.lastMessageTime}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
      
      {item.unreadCount && item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.userId === user?.id;
    const repliedToMessage = item.replyToMessageId && currentMessages.find(m => m.id === item.replyToMessageId);
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {/* Reply preview */}
          {repliedToMessage && (
            <View style={styles.replyPreview}>
              <View style={[styles.replyLine, isOwnMessage && styles.ownReplyLine]} />
              <Text style={[styles.replyText, isOwnMessage && styles.ownReplyText]} numberOfLines={1}>
                {repliedToMessage.text || 'Message'}
              </Text>
            </View>
          )}
          
          {/* Message content */}
          {item.messageType === 'voice' && item.audioUrl ? (
            <VoiceMessagePlayer
              audioUrl={item.audioUrl}
              duration={item.audioDuration || 0}
              isOwnMessage={isOwnMessage}
            />
          ) : (
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
              {item.text}
            </Text>
          )}
          
          {/* Reactions */}
          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(item.reactions).map(([emoji, userIds]) => {
                if (userIds.length === 0) return null;
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBadge, isOwnMessage && styles.ownReactionBadge]}
                    onPress={() => {
                      const hasReacted = userIds.includes(user?.id || '');
                      if (hasReacted) {
                        reactToMessage(item.id, emoji); // This will toggle it off
                      } else {
                        handleReactToMessage(item.id, emoji);
                      }
                    }}
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
          
          {/* Message time */}
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {(() => {
              try {
                // Parse the timestamp - handle various formats
                let date: Date;
                if (typeof item.createdAt === 'string') {
                  // Try parsing the ISO string
                  date = new Date(item.createdAt);
                  // If parsing failed, try to fix common issues
                  if (isNaN(date.getTime())) {
                    // Try removing timezone info and parsing as UTC
                    const cleaned = item.createdAt.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
                    date = new Date(cleaned + 'Z');
                  }
                } else {
                  date = new Date(item.createdAt);
                }
                
                if (isNaN(date.getTime())) {
                  console.warn('Invalid date for message:', item.id, item.createdAt);
                  return 'Invalid time';
                }
                
                // Show relative time for recent messages, absolute time for older ones
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                
                // Handle negative differences (future dates) - shouldn't happen but handle gracefully
                if (diffMs < 0) {
                  console.warn('Message timestamp is in the future:', item.id, date, 'now:', now);
                  // Show the actual time if it's in the future
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                
                if (diffMins < 1) {
                  return 'Just now';
                } else if (diffMins < 60) {
                  return `${diffMins}m ago`;
                } else if (diffHours < 24) {
                  return `${diffHours}h ago`;
                } else if (diffDays < 7) {
                  return `${diffDays}d ago`;
                } else {
                  // For older messages, show date and time
                  // Use UTC to avoid timezone issues
                  const day = date.getDate();
                  const month = date.toLocaleDateString('en-US', { month: 'short' });
                  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return `${day} ${month} ${time}`;
                }
              } catch (error) {
                console.error('Error formatting message time:', error, item.createdAt, 'Type:', typeof item.createdAt);
                return 'Invalid time';
              }
            })()}
          </Text>
          
          {/* Action buttons - always visible for easier access */}
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                console.log('[ChatScreen] Emoji button pressed for message:', item.id);
                setEmojiMenuForId(emojiMenuForId === item.id ? null : item.id);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.actionButtonText}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setReplyTo(item)}
            >
              <Text style={styles.actionButtonText}>↩️</Text>
            </TouchableOpacity>
            {isOwnMessage && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setEditingId(item.id);
                    setInputText(item.text);
                  }}
                >
                  <Text style={styles.actionButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteMessage(item.id)}
                >
                  <Text style={styles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {/* Emoji picker menu */}
          {emojiMenuForId === item.id && (
            <View style={[styles.emojiPicker, isOwnMessage && styles.ownEmojiPicker]}>
              {REACTIONS.map(emoji => {
                const hasReacted = item.reactions?.[emoji]?.includes(user?.id || '');
                return (
                <TouchableOpacity
                  key={emoji}
                    style={[styles.emojiButton, hasReacted && styles.emojiButtonActive]}
                    onPress={() => {
                      console.log('[ChatScreen] Emoji selected:', emoji, 'for message:', item.id);
                      handleReactToMessage(item.id, emoji);
                    }}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (showContacts) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('chat.messages', 'Messages')}</Text>
          <TouchableOpacity style={styles.newChatButton}>
            <Text style={styles.newChatButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Contacts List */}
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.contactsList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowContacts(true)}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.chatHeaderInfo}>
          <Image source={{ uri: selectedContact?.avatar }} style={styles.chatAvatar} />
          <View style={styles.chatUserInfo}>
            <Text style={styles.chatUserName}>{selectedContact?.name}</Text>
            <Text style={styles.chatUserStatus}>
              {selectedContact?.isOnline ? t('chat.online', 'Online') : t('chat.offline', 'Offline')}
            </Text>
          </View>
        </View>
        
        <View style={styles.chatHeaderActions}>
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => handleStartCall('audio')}
            disabled={!connected || !!activeCall}
          >
            <Text style={styles.callButtonText}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => handleStartCall('video')}
            disabled={!connected || !!activeCall}
          >
            <Text style={styles.callButtonText}>📹</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.wallpaperButton}
            onPress={() => setShowWallpaperPicker(true)}
          >
            <Text style={styles.wallpaperButtonText}>🎨</Text>
          </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreButtonText}>⋯</Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Incoming Call Modal */}
      {incomingCall && !activeCall && (
        <View style={styles.incomingCallOverlay}>
          <View style={styles.incomingCallModal}>
            <View style={styles.incomingCallAvatarContainer}>
              <Image 
                source={{ uri: contacts.find(c => c.id === incomingCall.callerUserId)?.avatar || '' }}
                style={styles.incomingCallAvatar}
              />
            </View>
            <Text style={styles.incomingCallTitle}>
              {incomingCall.callType === 'video' ? '📹' : '📞'} Incoming {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call
            </Text>
            <Text style={styles.incomingCallSubtitle}>
              {contacts.find(c => c.id === incomingCall.callerUserId)?.name || 'Unknown'}
            </Text>
            <View style={styles.incomingCallButtons}>
              <TouchableOpacity 
                style={[styles.callActionButton, styles.rejectCallButton]}
                onPress={handleRejectCall}
              >
                <Text style={styles.callActionButtonText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.callActionButton, styles.acceptCallButton]}
                onPress={handleAcceptCall}
              >
                <Text style={styles.callActionButtonText}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <View style={styles.activeCallOverlay}>
          {activeCall.callType === 'video' ? (
            // Video call UI
            <View style={styles.videoCallContainer}>
              {/* Remote video stream */}
              <RemoteVideoView 
                stream={remoteStream} 
                placeholderAvatar={contacts.find(c => c.id === activeCall.otherUserId)?.avatar}
                placeholderName={contacts.find(c => c.id === activeCall.otherUserId)?.name || 'Unknown'}
              />
              
              {/* Local video stream (picture-in-picture) */}
              {localStream && (
                <LocalVideoView stream={localStream} />
              )}
              
              {/* Call controls overlay */}
              <View style={styles.videoCallControls}>
                <Text style={styles.callDurationText}>
                  {callDuration > 0 ? formatCallDuration(callDuration) : 'Connecting...'}
                </Text>
                <View style={styles.callControlButtons}>
                  <TouchableOpacity 
                    style={[styles.callControlButton, isMuted && styles.callControlButtonActive]}
                    onPress={toggleMute}
                  >
                    <Text style={styles.callControlButtonText}>{isMuted ? '🔇' : '🎤'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.callControlButton, !isVideoEnabled && styles.callControlButtonActive]}
                    onPress={toggleVideo}
                  >
                    <Text style={styles.callControlButtonText}>{isVideoEnabled ? '📹' : '📷'}</Text>
                  </TouchableOpacity>
                  {isVideoEnabled && (
                    <TouchableOpacity 
                      style={styles.callControlButton}
                      onPress={switchCamera}
                    >
                      <Text style={styles.callControlButtonText}>🔄</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.callControlButton, styles.endCallButton]}
                    onPress={handleEndCall}
                  >
                    <Text style={styles.callControlButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            // Audio call UI
            <View style={styles.activeCallModal}>
              <View style={styles.activeCallAvatarContainer}>
                <Image 
                  source={{ uri: contacts.find(c => c.id === activeCall.otherUserId)?.avatar || '' }}
                  style={styles.activeCallAvatar}
                />
              </View>
              <Text style={styles.activeCallTitle}>
                📞 Audio Call
              </Text>
              <Text style={styles.activeCallSubtitle}>
                {contacts.find(c => c.id === activeCall.otherUserId)?.name || 'Unknown'}
              </Text>
              {callDuration > 0 ? (
                <Text style={styles.callDurationText}>
                  {formatCallDuration(callDuration)}
                </Text>
              ) : (
                <View style={styles.connectingContainer}>
                  <Text style={styles.callStatusText}>Connecting...</Text>
                  <Text style={styles.callHintText}>
                    Waiting for {contacts.find(c => c.id === activeCall.otherUserId)?.name || 'user'} to answer
                  </Text>
                </View>
              )}
              <View style={styles.activeCallButtons}>
                <TouchableOpacity 
                  style={[styles.callActionButton, isMuted && styles.callActionButtonActive]}
                  onPress={toggleMute}
                >
                  <Text style={styles.callActionButtonText}>{isMuted ? '🔇' : '🎤'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.callActionButton, styles.endCallButton]}
                  onPress={handleEndCall}
                >
                  <Text style={styles.callActionButtonText}>✕ End Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Messages with wallpaper background */}
      <View style={styles.messagesContainer}>
        {/* Wallpaper background */}
        {currentWallpaper?.wallpaperUrl && (
          <Image 
            source={{ uri: currentWallpaper.wallpaperUrl.startsWith('http') ? currentWallpaper.wallpaperUrl : `${chatServiceUrl}${currentWallpaper.wallpaperUrl}` }}
            style={[styles.wallpaperBackground, { opacity: currentWallpaper.opacity || wallpaperOpacity }]}
            resizeMode="cover"
          />
        )}
      <FlatList
        ref={flatListRef}
        data={currentMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isTyping ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {selectedContact?.name} is typing...
              </Text>
            </View>
          ) : null
        }
      />
      </View>

      {/* Wallpaper Picker Modal */}
      {showWallpaperPicker && (
        <View style={styles.wallpaperModalOverlay}>
          <View style={styles.wallpaperModal}>
            <View style={styles.wallpaperModalHeader}>
              <Text style={styles.wallpaperModalTitle}>Choose Background</Text>
              <TouchableOpacity 
                style={styles.wallpaperModalClose}
                onPress={() => setShowWallpaperPicker(false)}
              >
                <Text style={styles.wallpaperModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Opacity Control */}
            <View style={styles.opacityControl}>
              <Text style={styles.opacityLabel}>Opacity: {Math.round(wallpaperOpacity * 100)}%</Text>
              <View style={styles.opacityButtons}>
                {[0, 25, 50, 75, 100].map(opacity => (
                  <TouchableOpacity
                    key={opacity}
                    style={[
                      styles.opacityButton,
                      Math.round(wallpaperOpacity * 100) === opacity && styles.opacityButtonActive
                    ]}
                    onPress={() => setWallpaperOpacity(opacity / 100)}
                  >
                    <Text style={[
                      styles.opacityButtonText,
                      Math.round(wallpaperOpacity * 100) === opacity && styles.opacityButtonTextActive
                    ]}>
                      {opacity}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Wallpaper Grid */}
            <FlatList
              data={[{ id: 'none', name: 'None', previewUrl: null }, ...wallpapers]}
              numColumns={2}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.wallpaperItem,
                    currentWallpaper?.wallpaperId === item.id && styles.wallpaperItemSelected
                  ]}
                  onPress={() => {
                    if (item.id === 'none') {
                      saveWallpaper(null, null);
                    } else {
                      const url = item.previewUrl?.startsWith('http') 
                        ? item.previewUrl 
                        : `${chatServiceUrl}${item.previewUrl}`;
                      saveWallpaper(item.id, url);
                    }
                  }}
                >
                  {item.previewUrl ? (
                    <Image 
                      source={{ uri: item.previewUrl.startsWith('http') ? item.previewUrl : `${chatServiceUrl}${item.previewUrl}` }}
                      style={styles.wallpaperPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.wallpaperPreviewNone}>
                      <Text style={styles.wallpaperPreviewNoneText}>None</Text>
                    </View>
                  )}
                  <Text style={styles.wallpaperItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.wallpaperGrid}
            />
          </View>
        </View>
      )}

      {/* Connection Status */}
      {!connected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionText}>
            {connectionState === 'Reconnecting' 
              ? t('chat.reconnecting', 'Reconnecting...') 
              : connectionState === 'Failed'
              ? t('chat.connectionFailed', 'Connection failed')
              : t('chat.disconnected', 'Disconnected')}
          </Text>
          {connectionState === 'Failed' && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                console.log('Manual retry triggered');
                if (user?.id && token) {
                  retryConnect();
                } else {
                  Alert.alert('Error', 'Please log in to use chat');
                }
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <View style={styles.replyPreviewContainer}>
          <View style={styles.replyPreviewContent}>
            <View style={styles.replyPreviewLine} />
            <View style={styles.replyPreviewTextContainer}>
              <Text style={styles.replyPreviewLabel}>{t('chat.replyingTo', 'Replying to:')}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTo.text}</Text>
            </View>
            <TouchableOpacity
              style={styles.replyPreviewClose}
              onPress={() => setReplyTo(null)}
            >
              <Text style={styles.replyPreviewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit Indicator */}
      {editingId && (
        <View style={styles.editIndicatorContainer}>
          <Text style={styles.editIndicatorText}>{t('chat.editing', 'Editing message...')}</Text>
          <TouchableOpacity
            onPress={() => {
              setEditingId(null);
              setInputText("");
            }}
          >
            <Text style={styles.editIndicatorCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recording Indicator */}
      {isRecordingMode && (
        <View style={styles.recordingContainer}>
          <View style={styles.recordingIndicator}>
            <View style={[styles.recordingDot, { opacity: isRecording ? 1 : 0.3 }]} />
            <Text style={styles.recordingText}>
              {isRecording ? `Recording... ${recordingDuration}s` : 'Preparing to record...'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cancelRecordingButton}
            onPress={async () => {
              console.log('[ChatScreen] Cancel button pressed in recording indicator');
              await handleRecordCancel();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.cancelRecordingText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        {isRecordingMode ? (
          <View style={styles.recordingInputContainer}>
            <TouchableOpacity
              style={styles.cancelRecordingButtonInInput}
              onPress={async () => {
                console.log('[ChatScreen] Cancel button pressed in input');
                await handleRecordCancel();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelRecordingButtonTextInInput}>✕</Text>
            </TouchableOpacity>
            <View style={styles.recordingWaveformContainer}>
              <View style={{ flex: 1 }}>
                <AnimatedRecordingWaveform isRecording={isRecording} />
              </View>
              <Text style={styles.recordingDurationText}>
                {formatRecordingDuration(recordingDuration)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sendRecordingButton}
              onPress={async () => {
                console.log('[ChatScreen] Send button pressed');
                await handleSendRecording();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.sendRecordingButtonText}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputWrapper}>
            {/* Record Button (when input is empty) */}
            {!inputText.trim() && !editingId && (
              <TouchableOpacity
                ref={recordingButtonRef}
                style={styles.recordButton}
                onPressIn={async () => {
                  console.log('[ChatScreen] Record button pressed in');
                  await handleRecordPressIn();
                }}
                onPressOut={async () => {
                  console.log('[ChatScreen] Record button pressed out');
                  await handleRecordPressOut();
                }}
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.recordButtonText}>🎤</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.messageInput}
              placeholder={editingId ? t('chat.editPlaceholder', 'Edit message...') : t('chat.inputPlaceholder', 'Type a message...')}
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
                if (text.trim()) {
                  handleTyping();
                  setIsRecordingMode(false);
                } else {
                  handleStopTyping();
                }
              }}
              onBlur={handleStopTyping}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!inputText.trim() && !editingId) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() && !editingId}
            >
              <LinearGradient
                colors={(inputText.trim() || editingId) ? [colors.gradientStart, colors.gradientMid, colors.gradientEnd] : [colors.muted, colors.muted]}
                style={styles.sendButtonGradient}
              >
                <Text style={styles.sendButtonText}>{editingId ? '✓' : '→'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
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
  newChatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },

  // Contacts list styles
  contactsList: {
    paddingVertical: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  lastMessageTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
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
  unreadCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // Chat header styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    marginRight: 12,
  },
  chatUserInfo: {
    flex: 1,
  },
  chatUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  chatUserStatus: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    marginRight: 4,
  },
  callButtonText: {
    fontSize: 18,
  },
  moreButton: {
    padding: 4,
  },
  moreButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  // Messages styles
  messagesList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: colors.muted,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Input styles
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.muted,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },

  // Typing indicator styles
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.muted,
    borderRadius: 18,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  typingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // Connection status styles
  connectionStatus: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  connectionText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Reply preview styles
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  replyLine: {
    width: 3,
    height: 30,
    backgroundColor: colors.primary,
    marginRight: 8,
    borderRadius: 2,
  },
  ownReplyLine: {
    backgroundColor: 'white',
  },
  replyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  ownReplyText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  replyPreviewContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 12,
  },
  replyPreviewTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  replyPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 14,
    color: colors.text,
  },
  replyPreviewClose: {
    padding: 4,
  },
  replyPreviewCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Edit indicator styles
  editIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editIndicatorText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  editIndicatorCancel: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Voice message styles
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceMessageText: {
    fontSize: 16,
    color: colors.text,
  },
  ownVoiceMessageText: {
    color: 'white',
  },
  voiceDuration: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ownVoiceDuration: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Reactions styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownReactionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ownReactionCount: {
    color: 'rgba(255, 255, 255, 0.9)',
  },

  // Message action buttons
  messageActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
  },

  // Emoji picker styles
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    marginTop: 8,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownEmojiPicker: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'transparent',
    margin: 4,
  },
  emojiButtonActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emojiButtonText: {
    fontSize: 20,
  },

  // Call UI styles
  incomingCallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  incomingCallModal: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '90%',
  },
  incomingCallAvatarContainer: {
    marginBottom: 24,
  },
  incomingCallAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.muted,
  },
  incomingCallTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  incomingCallSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  incomingCallButtons: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  activeCallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  activeCallModal: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '90%',
  },
  activeCallAvatarContainer: {
    marginBottom: 24,
  },
  activeCallAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.muted,
  },
  activeCallTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  activeCallSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  callDurationText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  activeCallButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  callStatusText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  connectingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  callHintText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  callActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectCallButton: {
    backgroundColor: '#ef4444',
  },
  acceptCallButton: {
    backgroundColor: '#10b981',
  },
  endCallButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 120,
  },
  callActionButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  callActionButtonActive: {
    backgroundColor: '#6b7280',
  },
  // Video call styles
  videoCallContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: '#000',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoCallControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  callControlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  callControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callControlButtonActive: {
    backgroundColor: '#ef4444',
  },
  callControlButtonText: {
    fontSize: 24,
  },

  // Wallpaper styles
  messagesContainer: {
    flex: 1,
    position: 'relative',
  },
  wallpaperBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  wallpaperButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    marginRight: 4,
  },
  wallpaperButtonText: {
    fontSize: 18,
  },
  wallpaperModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  wallpaperModal: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  wallpaperModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  wallpaperModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  wallpaperModalClose: {
    padding: 8,
  },
  wallpaperModalCloseText: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  opacityControl: {
    marginBottom: 20,
  },
  opacityLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    fontWeight: '600',
  },
  opacityButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  opacityButton: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opacityButtonActive: {
    backgroundColor: colors.primary,
  },
  opacityButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  opacityButtonTextActive: {
    color: 'white',
  },
  wallpaperGrid: {
    padding: 4,
  },
  wallpaperItem: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wallpaperItemSelected: {
    borderColor: colors.primary,
  },
  wallpaperPreview: {
    width: '100%',
    height: 120,
    backgroundColor: colors.muted,
  },
  wallpaperPreviewNone: {
    width: '100%',
    height: 120,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wallpaperPreviewNoneText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  wallpaperItemName: {
    fontSize: 12,
    color: colors.text,
    padding: 8,
    textAlign: 'center',
    backgroundColor: colors.surface,
  },

  // Recording styles
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  cancelRecordingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.danger,
  },
  cancelRecordingText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  recordingInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.danger,
    borderRadius: 24,
    gap: 12,
  },
  recordingWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    height: 30,
  },
  recordingWaveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  recordingDurationText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  recordButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  recordButtonText: {
    fontSize: 20,
  },
  recordingWaveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cancelRecordingButtonInInput: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRecordingButtonTextInInput: {
    fontSize: 18,
    color: 'white',
    fontWeight: '700',
  },
  sendRecordingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendRecordingButtonText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
});
