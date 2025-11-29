import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, Alert, Animated, PanResponder, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { userApi, chatApi, endpoints, chatServiceUrl } from '../api/client';
import { useAuthStore } from '../state/auth';
import { useSignalRChat } from '../hooks/useSignalRChat';
import { useWebRTC } from '../hooks/useWebRTC';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import { SafeImage } from '../components/SafeImage';
import { MessageBubble } from '../components/MessageBubble';
import { EmojiGifPickerModal } from '../components/EmojiGifPickerModal';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  CallIcon, VideoCallIcon, MicIcon, CameraIcon, FlipCameraIcon,
  CloseIcon, CheckIcon, VoiceMessageIcon, ImageIcon, VideoIcon,
  SendIcon, EmojiIcon, PaletteIcon, MoreIcon, BackIcon, ReplyIcon, EditIcon, DeleteIcon
} from '../components/Icon';

// Conditionally import RTCView for native platforms
let RTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    const RTCModule = require('react-native-webrtc');
    if (RTCModule && RTCModule.RTCView && typeof RTCModule.RTCView === 'function') {
      RTCView = RTCModule.RTCView;
    }
  } catch (e: any) {
    // Silently handle all errors - WebRTC is optional
    // The "Super expression" error indicates a module loading issue,
    // which is expected if react-native-webrtc isn't properly linked
    RTCView = null;
  }
}

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

export const ChatScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeoutRef, setTypingTimeoutRef] = useState<NodeJS.Timeout | null>(null);
  const { user, token } = useAuthStore();
  const { updateContactUnreadCount } = useChatNotifications();
  const flatListRef = useRef<FlatList>(null);
  const restoredOnceRef = useRef(false);
  const lastConversationIdRef = useRef<string | null>(null);
  const hasScrolledToEndRef = useRef<Record<string, boolean>>({});
  const processedUserIdRef = useRef<string | null>(null);

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

  // Helper function to sort contacts by last message time (most recent first)
  const sortContactsByTime = (contacts: ChatContact[]): ChatContact[] => {
    return [...contacts].sort((a, b) => {
      // If both have valid timestamps, sort by time (most recent first)
      if (a.lastMessageTime && b.lastMessageTime) {
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        // Check for invalid dates (like "0001-01-01")
        if (!isNaN(timeA) && !isNaN(timeB) && timeA > 0 && timeB > 0) {
          return timeB - timeA; // Most recent first
        }
      }

      // If one has a timestamp and the other doesn't, prioritize the one with timestamp
      if (a.lastMessageTime && !b.lastMessageTime) {
        const timeA = new Date(a.lastMessageTime).getTime();
        if (!isNaN(timeA) && timeA > 0) {
          return -1; // a has valid timestamp, put it first
        }
      }
      if (b.lastMessageTime && !a.lastMessageTime) {
        const timeB = new Date(b.lastMessageTime).getTime();
        if (!isNaN(timeB) && timeB > 0) {
          return 1; // b has valid timestamp, put it first
        }
      }

      // Both have no messages or invalid timestamps, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  const updateConversationMessages = (conversationId: string, messages: ChatMessage[], triggerScroll: boolean = false) => {
    setConversations(prev => {
      const sorted = [...messages].sort((a, b) => {
        const timeA = new Date(a.sentAt || a.createdAt).getTime();
        const timeB = new Date(b.sentAt || b.createdAt).getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeA - timeB;
      });
      return {
        ...prev,
        [conversationId]: sorted
      };
    });
    
    // Trigger scroll after state update if this is the current conversation
    if (triggerScroll && conversationId === currentConversationId && messages.length > 0) {
      // Use a flag to trigger scroll after render
      setShouldScrollToEnd(conversationId);
    }
  };

  // Helper functions to detect image/video URLs (matching web frontend)
  const isCloudinaryUrl = useCallback((url: string): boolean => {
    try {
      return new URL(url).hostname.includes('cloudinary.com') || new URL(url).hostname.includes('res.cloudinary.com');
    } catch { return false; }
  }, []);

  const looksLikeImageUrl = useCallback((url: string): boolean => {
    const lower = url.toLowerCase();
    return /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif)(\?|#|$)/.test(lower) || (isCloudinaryUrl(url) && /\/image\//i.test(lower));
  }, [isCloudinaryUrl]);

  const looksLikeVideoUrl = useCallback((url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    // Check for video file extensions
    const hasVideoExtension = /(\.mp4|\.webm|\.ogg|\.mov|\.avi|\.mkv|\.flv|\.wmv)(\?|#|$)/.test(lower);
    // Check for Cloudinary video URLs (they contain /video/ in the path)
    const isCloudinaryVideo = isCloudinaryUrl(url) && /\/video\//i.test(lower);
    // Check if URL contains /video/ in path (for CDNs like Cloudinary, but be more specific)
    const hasVideoInPath = /\/video\/[^\/]+/i.test(lower);
    return hasVideoExtension || isCloudinaryVideo || hasVideoInPath;
  }, [isCloudinaryUrl]);

  const isYouTubeUrl = useCallback((url: string): boolean => {
    const lower = url.toLowerCase();
    return /youtube\.com\/watch\?v=|youtu\.be\//.test(lower);
  }, []);

  const looksLikeGifMessage = useCallback((text: string): boolean => {
    if (!text || typeof text !== 'string') return false;
    // Check for GIF format: ![GIF](url)
    return /!\[GIF\]\(/i.test(text);
  }, []);

  const getYouTubeThumbnail = useCallback((url: string): string | null => {
    if (!isYouTubeUrl(url)) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match && match[1]) {
      return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    }
    return null;
  }, [isYouTubeUrl]);

  const getYouTubeEmbedUrl = useCallback((url: string): string | null => {
    if (!isYouTubeUrl(url)) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  }, [isYouTubeUrl]);

  // Get video thumbnail for Cloudinary videos
  const getVideoThumbnail = useCallback((videoUrl: string): string | null => {
    if (!videoUrl || typeof videoUrl !== 'string') return null;

    // For Cloudinary videos, generate a thumbnail by converting to image
    if (isCloudinaryUrl(videoUrl) && /\/video\//i.test(videoUrl.toLowerCase())) {
      try {
        // Cloudinary automatically extracts a frame when converting video to image
        // URL structure examples:
        // https://res.cloudinary.com/{cloud_name}/video/upload/{transformations}/v{version}/{public_id}.{format}
        // https://res.cloudinary.com/{cloud_name}/video/upload/v{version}/{public_id}.{format}
        // https://res.cloudinary.com/{cloud_name}/video/upload/{public_id}.{format}

        // Parse the URL to extract components
        const urlParts = videoUrl.split('?');
        const baseUrl = urlParts[0];
        const queryParams = urlParts[1] ? `?${urlParts[1]}` : '';

        // Replace /video/ with /image/ to convert video resource to image
        // Cloudinary will automatically extract the first frame
        let thumbnailUrl = baseUrl.replace(/\/video\//i, '/image/');

        // Replace video file extensions with jpg, or add .jpg if no extension
        if (/\.(mp4|webm|mov|avi|mkv|flv|wmv)(\?|#|$)/i.test(thumbnailUrl)) {
          thumbnailUrl = thumbnailUrl.replace(/\.(mp4|webm|mov|avi|mkv|flv|wmv)(\?|#|$)/i, '.jpg$2');
        } else if (!/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(thumbnailUrl)) {
          // Add .jpg extension if not present
          thumbnailUrl = `${thumbnailUrl}.jpg`;
        }

        // Add query params back
        thumbnailUrl = `${thumbnailUrl}${queryParams}`;

        console.log('[ChatScreen] Generated thumbnail URL:', thumbnailUrl, 'from:', videoUrl);
        return thumbnailUrl;
      } catch (error) {
        console.error('[ChatScreen] Error generating video thumbnail:', error);
        return null;
      }
    }

    return null;
  }, [isCloudinaryUrl]);

  const addMessageToConversation = (conversationId: string, message: ChatMessage) => {
    setConversations(prev => {
      const currentMessages = prev[conversationId] || [];
      if (currentMessages.some(m => m.id === message.id)) {
        return prev;
      }
      const newMessages = [...currentMessages, message].sort((a, b) => {
        const timeA = new Date(a.sentAt || a.createdAt).getTime();
        const timeB = new Date(b.sentAt || b.createdAt).getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeA - timeB;
      });
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
  const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮", "😢", "🔥", "✅", "❌", "👌", "😁", "🙏", "🤔", "😎", "💖"];

  // Call state
  const [incomingCall, setIncomingCall] = useState<{ callerUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ otherUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs to track call state for synchronous access in signal handlers
  const activeCallRef = useRef<{ otherUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);
  const incomingCallRef = useRef<{ callerUserId: string; callType: 'audio' | 'video'; callId: string } | null>(null);

  // Wallpaper state
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [wallpapers, setWallpapers] = useState<any[]>([]);
  const [currentWallpaper, setCurrentWallpaper] = useState<{ wallpaperId: string | null; wallpaperUrl: string | null; opacity: number } | null>(null);
  const [wallpaperOpacity, setWallpaperOpacity] = useState(0.25);
  // Custom wallpaper upload state
  const [showCustomWallpaperUpload, setShowCustomWallpaperUpload] = useState(false);
  const [customWallpaperUri, setCustomWallpaperUri] = useState<string | null>(null);
  const [customWallpaperName, setCustomWallpaperName] = useState('');
  const [customWallpaperDescription, setCustomWallpaperDescription] = useState('');
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

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

  // Media attachment state
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; mediaType: 'image' | 'video'; name?: string } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiGifPicker, setShowEmojiGifPicker] = useState(false);
  const [emojiGifPickerTab, setEmojiGifPickerTab] = useState<'emoji' | 'gif'>('emoji');

  // Full-screen image viewer state
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  // Full-screen video viewer state
  const [enlargedVideo, setEnlargedVideo] = useState<string | null>(null);
  const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number } | null>(null);

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

      // Extract custom data for voice/media messages
      const customData = typeof payload === 'object' ? payload?.customData : null;
      let messageType = customData?.messageType || 'text';

      // Auto-detect image/video/YouTube from URL if messageType is not set
      if (messageType === 'text' && text) {
        if (looksLikeImageUrl(text)) {
          messageType = 'image';
        } else if (isYouTubeUrl(text)) {
          messageType = 'video';
        } else if (looksLikeVideoUrl(text)) {
          messageType = 'video';
        }
      }

      const audioUrl = customData?.audioUrl;
      const audioDuration = customData?.audioDuration;
      const imageUrl = customData?.imageUrl || (messageType === 'image' ? text : null);
      const videoUrl = customData?.videoUrl || (messageType === 'video' ? text : null);

      // Log voice/media messages for debugging
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
      } else if (messageType === 'image' || messageType === 'video') {
        console.log('[ChatScreen] onMessageReceived - Media message received:', {
          id,
          sender,
          messageType,
          imageUrl: imageUrl || text,
          videoUrl: videoUrl || text,
          customData: JSON.stringify(customData)
        });
      }

      const newMessage: ChatMessage = {
        id,
        text,
        userId: sender,
        username: username || 'Unknown',
        createdAt: serverTimestamp,
        sentAt: serverTimestamp, // Also set sentAt for consistency
        replyToMessageId,
        messageType: messageType as 'text' | 'voice' | 'image' | 'video',
        ...(audioUrl && { audioUrl }),
        ...(audioDuration !== null && audioDuration !== undefined && { audioDuration }),
        ...(imageUrl && { imageUrl }),
        ...(videoUrl && { videoUrl })
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

        const lastMessagePreview = messageType === 'voice' ? 'Voice message' : text;
        setContacts(prev => {
          const updated = prev.map(contact =>
            contact.id === selectedContact.id
              ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
              : contact
          );
          return sortContactsByTime(updated);
        });
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
          let lastMessagePreview = text;
          if (messageType === 'voice') {
            lastMessagePreview = 'Voice message';
          } else if (messageType === 'image') {
            lastMessagePreview = 'Image';
          } else if (messageType === 'video') {
            lastMessagePreview = 'Video';
          } else if (text && text.length > 50) {
            lastMessagePreview = text.substring(0, 50) + '...';
          }

          setContacts(prev => {
            const existingContact = prev.find(c => c.id === targetContactId);
            if (existingContact) {
              // Update existing contact
              const updated = prev.map(contact =>
                contact.id === targetContactId
                  ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
                  : contact
              );
              // Sort contacts by last message time (most recent first)
              const sorted = sortContactsByTime(updated);
              console.log('[ChatScreen] Reordered contacts after sending message:', sorted.map(c => ({
                name: c.name,
                lastMessageTime: c.lastMessageTime
              })));
              return sorted;
            } else {
              // Contact not in list - this shouldn't happen if handleContactSelect worked, but handle it anyway
              console.log('[ChatScreen] Contact not found in list when updating after send, skipping update');
              return prev;
            }
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
        let lastMessagePreview = text;
        if (messageType === 'voice') {
          lastMessagePreview = 'Voice message';
        } else if (messageType === 'image') {
          lastMessagePreview = 'Image';
        } else if (messageType === 'video') {
          lastMessagePreview = 'Video';
        } else if (text && text.length > 50) {
          lastMessagePreview = text.substring(0, 50) + '...';
        }

        const isViewingThisConversation = selectedContact?.id === sender && currentConversationId === getConversationId(sender);

        setContacts(prev => {
          const contactExists = prev.find(c => c.id === sender);
          if (!contactExists) {
            // Add new contact if not in list (e.g., someone who isn't following you sent a message)
            const newContact: ChatContact = {
              id: sender,
              name: username || 'Unknown',
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username || sender)}`,
              lastMessage: lastMessagePreview,
              lastMessageTime: serverTimestamp,
              unreadCount: !isViewingThisConversation ? 1 : 0,
              isOnline: false,
              isFollowing: false
            };
            const sorted = sortContactsByTime([...prev, newContact]);
            console.log('[ChatScreen] Added new contact to list after receiving message:', newContact.name);
            return sorted;
          }

          const updated = prev.map(contact => {
            if (contact.id === sender) {
              const currentUnread = contact.unreadCount || 0;
              const newUnreadCount = !isViewingThisConversation ? currentUnread + 1 : 0;
              return {
                ...contact,
                lastMessage: lastMessagePreview,
                lastMessageTime: serverTimestamp,
                unreadCount: newUnreadCount
              };
            }
            return contact;
          });

          return sortContactsByTime(updated);
        });

        // Update notification badge in real-time when message is received from another user
        if (!isViewingThisConversation) {
          updateContactUnreadCount(sender);
        }
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
    setConnectionStateCallback,
    toggleMute,
    toggleVideo,
    switchCamera,
    endCall: endWebRTCCall,
    isMuted,
    isVideoEnabled,
    isWebRTCAvailable,
  } = useWebRTC();

  // Video components for web and native
  const RemoteVideoView = ({ stream, placeholderAvatar, placeholderName }: { stream: any | null; placeholderAvatar?: string; placeholderName: string }) => {
    const videoRef = useRef<any>(null);

    useEffect(() => {
      if (Platform.OS === 'web' && videoRef.current && stream) {
        const videoElement = videoRef.current;

        // Avoid resetting if it's the same stream to prevent AbortError
        if (videoElement.srcObject === stream) {
          return;
        }

        videoElement.srcObject = stream as any;

        // Ensure audio plays for audio-only calls
        videoElement.volume = 1.0;
        videoElement.muted = false;

        // Play the video/audio
        const playPromise = videoElement.play();

        if (playPromise !== undefined) {
          playPromise.catch((error: any) => {
            // Ignore AbortError which happens when play is interrupted (e.g. by new stream load)
            // Check both name and message to be robust
            if (error.name === 'AbortError' || error.message?.includes('AbortError') || error.toString().includes('AbortError')) {
              // console.log('[ChatScreen] Video play aborted (likely due to stream update)');
              return;
            }

            console.error('[ChatScreen] Error playing remote stream on web:', error);
            // Retry on user interaction if autoplay was blocked
            if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
              const playOnInteraction = () => {
                videoElement.play().catch((e: any) => {
                  if (e.name !== 'AbortError' && !e.message?.includes('AbortError')) {
                    console.error('[ChatScreen] Retry play failed:', e);
                  }
                });
                document.removeEventListener('click', playOnInteraction);
              };
              document.addEventListener('click', playOnInteraction, { once: true });
            }
          });
        }
      }
    }, [stream]);

    // Web platform - use HTML video element (works for both audio and video)
    if (Platform.OS === 'web' && stream) {
      const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;
      return (
        <View style={styles.remoteVideo}>
          {/* @ts-ignore - React Native Web supports video element */}
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: hasVideo ? 'block' : 'none', // Hide for audio-only but keep for audio playback
            }}
            autoPlay
            playsInline
          />
          {!hasVideo && (
            <View style={styles.remoteVideoPlaceholder}>
              {placeholderAvatar ? (
                <Image
                  source={{ uri: placeholderAvatar }}
                  style={styles.activeCallAvatar}
                />
              ) : null}
              <Text style={styles.activeCallSubtitle}>
                {placeholderName}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Native platform - use RTCView (works for both audio and video)
    if (Platform.OS !== 'web' && stream && RTCView) {
      // For audio-only calls, still render RTCView but show placeholder UI
      const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks && stream.getAudioTracks().length > 0;

      console.log('[ChatScreen] Rendering RTCView - hasVideo:', hasVideo, 'hasAudio:', hasAudio, 'tracks:', stream.getTracks?.()?.map((t: any) => ({ kind: t.kind, enabled: t.enabled, id: t.id })));

      // Ensure all tracks are enabled
      if (stream.getTracks) {
        stream.getTracks().forEach((track: any) => {
          if (!track.enabled) {
            console.log('[ChatScreen] Enabling track:', track.kind, track.id);
            track.enabled = true;
          }
        });
      }

      // Try using streamURL if available (older react-native-webrtc versions)
      const streamURL = stream.toURL ? stream.toURL() : null;

      return (
        <View style={styles.remoteVideo}>
          {streamURL ? (
            <RTCView
              streamURL={streamURL}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={false}
              zOrder={0}
            />
          ) : (
            <RTCView
              stream={stream}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={false}
              zOrder={0}
            />
          )}
          {!hasVideo && (
            <View style={styles.remoteVideoPlaceholder}>
              {placeholderAvatar ? (
                <Image
                  source={{ uri: placeholderAvatar }}
                  style={styles.activeCallAvatar}
                />
              ) : null}
              <Text style={styles.activeCallSubtitle}>
                {placeholderName}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Fallback placeholder
    return (
      <View style={styles.remoteVideoPlaceholder}>
        {placeholderAvatar ? (
          <Image
            source={{ uri: placeholderAvatar }}
            style={styles.activeCallAvatar}
          />
        ) : null}
        <Text style={styles.activeCallSubtitle}>
          {stream ? t('chat.video', 'Video') : placeholderName}
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

    // Web platform - use HTML video element
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

    // Native platform - use RTCView with mirror for self-view
    if (Platform.OS !== 'web' && stream && RTCView) {
      // Ensure all tracks are enabled
      if (stream.getTracks) {
        stream.getTracks().forEach((track: any) => {
          if (!track.enabled) {
            console.log('[ChatScreen] Enabling local track:', track.kind, track.id);
            track.enabled = true;
          }
        });
      }

      // Try using streamURL if available
      const streamURL = stream.toURL ? stream.toURL() : null;

      return (
        <RTCView
          {...(streamURL ? { streamURL } : { stream })}
          style={styles.localVideoContainer}
          objectFit="cover"
          mirror={true}
          zOrder={0}
        />
      );
    }

    // Fallback placeholder
    return (
      <View style={styles.localVideoContainer}>
        <Text style={styles.activeCallSubtitle}>{t('chat.video', 'Video')}</Text>
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

      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setIceCandidateCallback(async (candidate) => {
        try {
          await sendCallSignal(selectedContact.id, callId, 'ice-candidate', candidate);
        } catch (error) {
          console.error('[ChatScreen] Error sending ICE candidate:', error);
        }
      });

      setConnectionStateCallback((state) => {
        console.log('[ChatScreen] WebRTC connection state changed:', state);
        if (state === 'connected') {
          console.log('[ChatScreen] WebRTC connection established!');
          // Start call duration timer if not already started
          // Use setTimeout to ensure activeCall state is updated
          setTimeout(() => {
            if (!callDurationIntervalRef.current) {
              console.log('[ChatScreen] Starting call duration timer after connection established');
              setCallStartTime(new Date());
              setCallDuration(0);
              startCallDurationTimer();
            }
          }, 100);
        } else if (state === 'failed') {
          console.error('[ChatScreen] WebRTC connection failed!');
          setError('Connection failed. Please try again.');
          setTimeout(() => setError(null), 3000);
        }
      });

      const success = await initiateCall(selectedContact.id, callType, callId);
      if (success) {
        const newCall = { otherUserId: selectedContact.id, callType, callId };
        setActiveCall(newCall);
        activeCallRef.current = newCall;
        // Don't start timer yet - wait for call to be accepted
        // Don't create offer yet - wait for call to be accepted
        // The offer will be created in the onCallAccepted handler
      } else {
        endWebRTCCall();
        setError('Failed to start call');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error: any) {
      console.error('[ChatScreen] Error starting call:', error);
      endWebRTCCall();
      
      // Show user-friendly error message
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('WebRTC is not available') || errorMessage.includes('not available on this platform')) {
        // Check if we're in Expo Go - if so, media capture should work but peer connections won't
        Alert.alert(
          'Calling Limitations',
          'In Expo Go, media capture works but peer-to-peer calls require a development build.\n\nFor full calling support:\n1. Run: npx expo run:android\n2. Install the generated app\n3. Calls will work fully in the dev build',
          [{ text: 'OK' }]
        );
      } else {
        setError('Failed to start call. Please try again.');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user?.id) return;

    try {
      const callToAccept = { ...incomingCall };

      await getLocalStream(callToAccept.callType === 'video');

      createPeerConnection();

      setIceCandidateCallback(async (candidate) => {
        try {
          await sendCallSignal(callToAccept.callerUserId, callToAccept.callId, 'ice-candidate', candidate);
        } catch (error) {
          console.error('[ChatScreen] Error sending ICE candidate:', error);
        }
      });

      setConnectionStateCallback((state) => {
        console.log('[ChatScreen] WebRTC connection state changed:', state);
        if (state === 'connected') {
          console.log('[ChatScreen] WebRTC connection established!');
          // Start call duration timer if not already started
          if (!callDurationIntervalRef.current) {
            console.log('[ChatScreen] Starting call duration timer after connection established (callee)');
            setCallStartTime(new Date());
            setCallDuration(0);
            startCallDurationTimer();
          }
        } else if (state === 'failed') {
          console.error('[ChatScreen] WebRTC connection failed!');
          setError('Connection failed. Please try again.');
          setTimeout(() => setError(null), 3000);
        }
      });

      const newCall = {
        otherUserId: callToAccept.callerUserId,
        callType: callToAccept.callType,
        callId: callToAccept.callId
      };
      setActiveCall(newCall);
      activeCallRef.current = newCall;
      setIncomingCall(null);
      incomingCallRef.current = null;

      setCallStartTime(new Date());
      setCallDuration(0);
      startCallDurationTimer();

      await acceptCall(callToAccept.callerUserId, callToAccept.callId);
    } catch (error: any) {
      console.error('[ChatScreen] Error accepting call:', error);
      endWebRTCCall();
      setActiveCall(null);
      activeCallRef.current = null;
      setIncomingCall(null);
      incomingCallRef.current = null;
      
      // Show user-friendly error message
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('WebRTC is not available') || errorMessage.includes('not available on this platform')) {
        // Check if we're in Expo Go - if so, media capture should work but peer connections won't
        Alert.alert(
          'Calling Limitations',
          'In Expo Go, media capture works but peer-to-peer calls require a development build.\n\nFor full calling support:\n1. Run: npx expo run:android\n2. Install the generated app\n3. Calls will work fully in the dev build',
          [{ text: 'OK' }]
        );
      } else {
        setError('Failed to accept call');
        setTimeout(() => setError(null), 3000);
      }
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

  // Effect to start timer when remote stream is received (fallback for connection state)
  useEffect(() => {
    if (remoteStream && activeCall && !callDurationIntervalRef.current) {
      console.log('[ChatScreen] Remote stream detected via effect. Starting timer.');
      setCallStartTime(new Date());
      setCallDuration(0);
      startCallDurationTimer();
    }
  }, [remoteStream, activeCall, startCallDurationTimer]);

  // Auto-scroll to bottom when messages are loaded or updated
  useEffect(() => {
    if (currentMessages.length > 0 && currentConversationId) {
      // Check if this is a new conversation (first time loading)
      const isNewConversation = lastConversationIdRef.current !== currentConversationId;
      lastConversationIdRef.current = currentConversationId;
      
      // Use multiple attempts with increasing delays to ensure scroll works
      // This handles cases where FlatList might not be fully rendered yet
      // For new conversations, use more attempts and longer delays
      const attemptScroll = (attempt: number = 0) => {
        const maxAttempts = isNewConversation ? 5 : 3;
        if (attempt > maxAttempts) return;
        
        const delay = isNewConversation 
          ? (attempt === 0 ? 300 : attempt * 200) // Longer delays for first load
          : (attempt === 0 ? 100 : attempt * 200);
        
        setTimeout(() => {
          if (flatListRef.current) {
            try {
              flatListRef.current.scrollToEnd({ animated: attempt > 0 && !isNewConversation });
              if (isNewConversation) {
                hasScrolledToEndRef.current[currentConversationId] = true;
              }
            } catch (error) {
              // If scroll fails, try again with longer delay
              if (attempt < maxAttempts) {
                attemptScroll(attempt + 1);
              }
            }
          } else if (attempt < maxAttempts) {
            // FlatList not ready yet, try again
            attemptScroll(attempt + 1);
          }
        }, delay);
      };
      
      attemptScroll();
    }
  }, [currentMessages.length, currentConversationId, selectedContact?.id, shouldScrollToEnd]);

  // Handle scroll trigger from message updates - this is the main scroll mechanism for first load
  useEffect(() => {
    if (shouldScrollToEnd && shouldScrollToEnd === currentConversationId && currentMessages.length > 0) {
      // Use multiple requestAnimationFrame calls to ensure we're after all renders
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollToBottom = (attempt: number = 0) => {
              if (attempt > 15) {
                // Give up after 15 attempts
                setShouldScrollToEnd(null);
                hasScrolledToEndRef.current[currentConversationId] = true;
                return;
              }
              
              const delay = attempt === 0 ? 200 : attempt < 5 ? attempt * 150 : attempt * 100;
              
              setTimeout(() => {
                if (flatListRef.current) {
                  try {
                    // Force scroll to end without animation for first load
                    flatListRef.current.scrollToEnd({ animated: false });
                    // Verify it worked by checking if we can scroll more (if not, we're at the end)
                    setShouldScrollToEnd(null);
                    hasScrolledToEndRef.current[currentConversationId] = true;
                  } catch (error) {
                    console.log('[ChatScreen] Scroll attempt', attempt, 'failed, retrying...');
                    if (attempt < 15) {
                      scrollToBottom(attempt + 1);
                    } else {
                      setShouldScrollToEnd(null);
                    }
                  }
                } else {
                  // FlatList not ready, try again
                  if (attempt < 15) {
                    scrollToBottom(attempt + 1);
                  } else {
                    setShouldScrollToEnd(null);
                  }
                }
              }, delay);
            };
            scrollToBottom();
          });
        });
      });
    }
  }, [shouldScrollToEnd, currentConversationId, currentMessages.length]);

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

  // Format date for date dividers (Today, Yesterday, or date like "20 November")
  const formatDateDivider = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.getTime() === today.getTime()) {
      return t('chat.today', 'Today');
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return t('chat.yesterday', 'Yesterday');
    } else {
      // Format as "20 November" or similar
      const months = [
        t('chat.month.january', 'January'),
        t('chat.month.february', 'February'),
        t('chat.month.march', 'March'),
        t('chat.month.april', 'April'),
        t('chat.month.may', 'May'),
        t('chat.month.june', 'June'),
        t('chat.month.july', 'July'),
        t('chat.month.august', 'August'),
        t('chat.month.september', 'September'),
        t('chat.month.october', 'October'),
        t('chat.month.november', 'November'),
        t('chat.month.december', 'December'),
      ];
      return `${messageDate.getDate()} ${months[messageDate.getMonth()]}`;
    }
  };

  // Get date key for grouping messages by day
  const getDateKey = (timestamp: string): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    } catch {
      return '';
    }
  };

  // Group messages by date and insert date dividers
  const getMessagesWithDateDividers = (messages: ChatMessage[]): Array<ChatMessage | { type: 'dateDivider'; date: string; id: string }> => {
    if (!messages || messages.length === 0) return [];
    
    const result: Array<ChatMessage | { type: 'dateDivider'; date: string; id: string }> = [];
    let lastDateKey = '';
    
    messages.forEach((message, index) => {
      const timestamp = message.sentAt || message.createdAt || '';
      const dateKey = getDateKey(timestamp);
      
      // Insert date divider if this is a new day
      if (dateKey && dateKey !== lastDateKey) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          result.push({
            type: 'dateDivider',
            date: formatDateDivider(date),
            id: `date-divider-${dateKey}-${index}`,
          });
        }
        lastDateKey = dateKey;
      }
      
      result.push(message);
    });
    
    return result;
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    try {
      console.log('[ChatScreen] Rejecting call:', incomingCall);
      await rejectCall(incomingCall.callerUserId, incomingCall.callId);
      setIncomingCall(null);
      incomingCallRef.current = null;
    } catch (error) {
      console.error('[ChatScreen] Error rejecting call:', error);
      setIncomingCall(null); // Clear state even if API call fails
      incomingCallRef.current = null;
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    try {
      console.log('[ChatScreen] Ending call:', activeCall);
      // End WebRTC call (cleanup media streams)
      endWebRTCCall();
      // End SignalR call signaling with duration
      const duration = callDuration; // Current call duration in seconds
      await endCallSignalR(activeCall.otherUserId, activeCall.callId, duration);
      stopCallDurationTimer();
      setActiveCall(null);
      activeCallRef.current = null;
      setCallDuration(0);
      setCallStartTime(null);
    } catch (error) {
      console.error('[ChatScreen] Error ending call:', error);
      // Cleanup even if API call fails
      endWebRTCCall();
      stopCallDurationTimer();
      setActiveCall(null);
      activeCallRef.current = null;
      setCallDuration(0);
      setCallStartTime(null);
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
        const newIncomingCall = {
          callerUserId: data.callerUserId,
          callType: data.callType as 'audio' | 'video',
          callId: data.callId
        };
        setIncomingCall(newIncomingCall);
        incomingCallRef.current = newIncomingCall;
        // Play notification sound/vibration here if needed
      } else if (data.callerUserId === user?.id) {
        console.log('[ChatScreen] Outgoing call confirmed to:', data.calleeUserId);
        // Call was initiated by us, make sure activeCall is set
        if (!activeCall || activeCall.callId !== data.callId) {
          const newCall = {
            otherUserId: data.calleeUserId,
            callType: data.callType as 'audio' | 'video',
            callId: data.callId
          };
          setActiveCall(newCall);
          activeCallRef.current = newCall;
        }
      }
    });

    const offCallAccepted = onCallAccepted(async (data) => {
      console.log('[ChatScreen] Call accepted event received:', data);
      console.log('[ChatScreen] Current activeCall:', activeCall);
      console.log('[ChatScreen] Current user ID:', user?.id);

      // Update active call state
      if (data.callerUserId === user?.id || data.calleeUserId === user?.id) {
        const otherUserId = data.callerUserId === user?.id ? data.calleeUserId : data.callerUserId;
        const callType = activeCall?.callType || incomingCall?.callType || (data as any).callType || 'audio';

        console.log('[ChatScreen] Updating call state - otherUserId:', otherUserId, 'callType:', callType);

        // Only update if we don't already have an active call, or if it's a different call
        if (!activeCall || activeCall.callId !== data.callId) {
          const newCall = {
            otherUserId,
            callType,
            callId: data.callId
          };
          setActiveCall(newCall);
          activeCallRef.current = newCall;
        }

        setIncomingCall(null);
        incomingCallRef.current = null;

        // If we're the caller, create and send the offer now that call is accepted
        if (data.callerUserId === user?.id) {
          try {
            console.log('[ChatScreen] We are the caller, creating offer after call accepted');
            const offer = await createOffer(callType === 'video');
            await sendCallSignal(otherUserId, data.callId, 'offer', offer);
            console.log('[ChatScreen] Offer sent after call accepted');
            // Note: Timer will start when connection is established (in connection state callback)
          } catch (error) {
            console.error('[ChatScreen] Error creating/sending offer after call accepted:', error);
          }
        } else {
          // For callee, start timer immediately after accepting
          // Timer will also be started in connection state callback as backup
          if (!callDurationIntervalRef.current) {
            console.log('[ChatScreen] Starting call duration timer from event (callee)');
            setCallStartTime(new Date());
            setCallDuration(0);
            startCallDurationTimer();
          }
        }
      } else {
        console.warn('[ChatScreen] Call accepted event for different users:', data);
      }
    });

    const offCallRejected = onCallRejected((data) => {
      console.log('[ChatScreen] Call rejected event:', data);
      stopCallDurationTimer();
      setActiveCall(null);
      activeCallRef.current = null;
      setIncomingCall(null);
      incomingCallRef.current = null;
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
      activeCallRef.current = null;
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallStartTime(null);
      setCallDuration(0);
    });

    const offCallSignal = onCallSignal(async (data) => {
      console.log('[ChatScreen] Received call signal:', data.signalType, 'for callId:', data.callId);
      console.log('[ChatScreen] Current activeCall:', activeCallRef.current);
      console.log('[ChatScreen] Current incomingCall:', incomingCallRef.current);
      console.log('[ChatScreen] Current user ID:', user?.id);

      // Check if this signal is for us (we're either caller or callee)
      const isForUs = (data.callerUserId === user?.id || data.calleeUserId === user?.id);
      if (!isForUs) {
        console.log('[ChatScreen] Ignoring call signal - not for us');
        return;
      }

      // Use refs for synchronous access, but also check state
      const currentCall = activeCallRef.current || incomingCallRef.current || activeCall || incomingCall;

      // If we don't have call state but the signal is for us, try to create/restore it
      if (!currentCall || currentCall.callId !== data.callId) {
        console.log('[ChatScreen] No matching call state found, but signal is for us. Attempting to restore call state...');

        // Try to determine if we're caller or callee and restore call state
        const otherUserId = data.callerUserId === user?.id ? data.calleeUserId : data.callerUserId;
        const callType = (data as any).callType || 'audio';

        // If we're the caller and don't have activeCall, create it
        if (data.callerUserId === user?.id) {
          console.log('[ChatScreen] Restoring caller call state');
          const restoredCall = {
            otherUserId,
            callType: callType as 'audio' | 'video',
            callId: data.callId
          };
          setActiveCall(restoredCall);
          activeCallRef.current = restoredCall;
        }
        // If we're the callee and don't have incomingCall or activeCall, create it
        else if (data.calleeUserId === user?.id) {
          console.log('[ChatScreen] Restoring callee call state');
          // If it's an offer, we should have incomingCall or activeCall
          // If it's an answer or ICE candidate, we should have activeCall
          if (data.signalType === 'offer') {
            const restoredIncomingCall = {
              callerUserId: data.callerUserId,
              callType: callType as 'audio' | 'video',
              callId: data.callId
            };
            setIncomingCall(restoredIncomingCall);
            incomingCallRef.current = restoredIncomingCall;
          } else {
            // For answer or ICE candidate, we should have activeCall
            const restoredCall = {
              otherUserId: data.callerUserId,
              callType: callType as 'audio' | 'video',
              callId: data.callId
            };
            setActiveCall(restoredCall);
            activeCallRef.current = restoredCall;
          }
        }

        // Re-check after restoring state
        const updatedCall = activeCallRef.current || incomingCallRef.current;
        if (!updatedCall || updatedCall.callId !== data.callId) {
          console.warn('[ChatScreen] Still no matching call after restore attempt. Ignoring signal.');
          return;
        }
      }

      try {
        if (data.signalType === 'offer') {
          console.log('[ChatScreen] Received offer signal');

          // Check if we need to set up peer connection
          // This handles the case where offer arrives before we accepted the call
          if (!activeCall && incomingCall) {
            console.log('[ChatScreen] Setting up callee for incoming call (offer arrived before accept)');
            await getLocalStream(((data as any).callType || 'audio') === 'video');
            createPeerConnection();

            // Set up ICE candidate callback
            setIceCandidateCallback(async (candidate) => {
              try {
                await sendCallSignal(data.callerUserId, data.callId, 'ice-candidate', candidate);
              } catch (error) {
                console.error('[ChatScreen] Error sending ICE candidate:', error);
              }
            });

            // Set up connection state callback
            setConnectionStateCallback((state) => {
              console.log('[ChatScreen] WebRTC connection state changed:', state);
              if (state === 'connected') {
                console.log('[ChatScreen] WebRTC connection established!');
                // Start call duration timer if not already started
                if (!callDurationIntervalRef.current) {
                  console.log('[ChatScreen] Starting call duration timer after connection established (offer received)');
                  setCallStartTime(new Date());
                  setCallDuration(0);
                  startCallDurationTimer();
                }
              } else if (state === 'failed') {
                console.error('[ChatScreen] WebRTC connection failed!');
                setError('Connection failed. Please try again.');
                setTimeout(() => setError(null), 3000);
              }
            });
          } else if (activeCall) {
            console.log('[ChatScreen] Peer connection already set up (call was accepted), processing offer');
            // Peer connection was already created in handleAcceptCall
            // Just need to process the offer and create answer
          } else {
            console.warn('[ChatScreen] Received offer but no call state found');
          }

          // Create and send answer
          console.log('[ChatScreen] Creating answer for offer');
          const answer = await createAnswer(data.signalData);
          console.log('[ChatScreen] Created answer, sending to caller');
          await sendCallSignal(data.callerUserId, data.callId, 'answer', answer);
        } else if (data.signalType === 'answer') {
          console.log('[ChatScreen] Received answer signal');
          await setRemoteDescription(data.signalData);
        } else if (data.signalType === 'ice-candidate') {
          console.log('[ChatScreen] Received ICE candidate signal');
          await addIceCandidate(data.signalData);
        }
      } catch (error) {
        console.error('[ChatScreen] Error handling call signal:', error);
        setError('Error processing call signal. Please try again.');
        setTimeout(() => setError(null), 3000);
      }
    });

    const markCurrentMessagesRead = async () => {
      if (!selectedContact?.id || !user?.id || currentMessages.length === 0) return;
      try {
        const unreadMessageIds = currentMessages
          .filter(m => m.userId !== user.id && !m.read)
          .map(m => m.id);
        if (unreadMessageIds.length > 0) {
          await markMessagesRead(selectedContact.id, unreadMessageIds);

          setConversations(prev => {
            const updated = { ...prev };
            if (currentConversationId && updated[currentConversationId]) {
              updated[currentConversationId] = updated[currentConversationId].map(m =>
                unreadMessageIds.includes(m.id) ? { ...m, read: true } : m
              );
            }
            return updated;
          });

          setContacts(prev => prev.map(c =>
            c.id === selectedContact.id
              ? { ...c, unreadCount: 0 }
              : c
          ));

          // Update notification badge in real-time
          updateContactUnreadCount(selectedContact.id);
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

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

  // Refresh contacts and messages when screen comes into focus
  useEffect(() => {
    if (!navigation) return;
    
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[ChatScreen] Screen focused, refreshing contacts and messages');
      // Always refresh contacts list to get latest messages and users
      if (user?.id) {
        fetchContacts();
        
        // If viewing a conversation, also refresh messages for that conversation
        if (selectedContact?.id) {
          fetchMessages(selectedContact.id).then((messages) => {
            if (messages && messages.length > 0) {
              const conversationId = getConversationId(selectedContact.id);
              updateConversationMessages(conversationId, messages, true);
            }
          }).catch((error) => {
            console.error('[ChatScreen] Failed to refresh messages on focus:', error);
          });
        }
      }
    });
    
    return unsubscribe;
  }, [navigation, selectedContact?.id, user?.id]);

  // Handle navigation with userId parameter (e.g., from profile page)
  useEffect(() => {
    const userId = route?.params?.userId;
    if (userId && user?.id && userId !== user.id) {
      // Check if we've already processed this userId
      if (processedUserIdRef.current === userId && selectedContact?.id === userId) {
        return; // Already processed and viewing this chat
      }
      
      // Check if we're already viewing this user's chat
      if (selectedContact?.id === userId) {
        processedUserIdRef.current = userId;
        return; // Already viewing this chat, no need to do anything
      }
      
      console.log('[ChatScreen] Opening chat with user from route params:', userId);
      processedUserIdRef.current = userId;
      
      // Check if contact already exists in contacts list
      const existingContact = contacts.find(c => c.id === userId);
      if (existingContact) {
        handleContactSelect(existingContact);
        return;
      }

      // If contact doesn't exist, fetch user info and create contact
      const loadUserAndOpenChat = async () => {
        try {
          const userResponse = await userApi.get(`/api/users/${userId}`);
          const userData = userResponse.data;
          
          const newContact: ChatContact = {
            id: String(userData.id),
            name: userData.name || userData.username || 'Unknown',
            avatar: userData.avatarUrl || userData.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.username || userId)}`,
            isOnline: false,
            isFollowing: false,
          };
          
          // Add to contacts list if not already there
          setContacts(prev => {
            const exists = prev.find(c => c.id === newContact.id);
            if (!exists) {
              return sortContactsByTime([...prev, newContact]);
            }
            return prev;
          });
          
          // Select the contact to open chat
          handleContactSelect(newContact);
        } catch (error) {
          console.error('[ChatScreen] Failed to load user for chat:', error);
          processedUserIdRef.current = null; // Reset on error so we can retry
        }
      };
      
      loadUserAndOpenChat();
    } else if (!route?.params?.userId) {
      // Reset the ref when userId param is cleared
      processedUserIdRef.current = null;
    }
  }, [route?.params?.userId, user?.id, contacts, selectedContact?.id]);

  const fetchContacts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get following users as contacts
      const response = await userApi.get(endpoints.getFollowing(user.id, 1, 50));
      const followingUsers = Array.isArray(response.data)
        ? response.data
        : (response.data?.items || response.data?.data || []);
      
      // Get all users you've had conversations with from the backend
      let conversationUsers: any[] = [];
      try {
        const conversationsResponse = await chatApi.get(endpoints.getConversations(user.id));
        const conversationsData = Array.isArray(conversationsResponse.data)
          ? conversationsResponse.data
          : (conversationsResponse.data?.items || conversationsResponse.data?.data || []);
        
        console.log('[ChatScreen] Found', conversationsData.length, 'conversations from backend');
        
        // Extract user IDs and last message data
        const conversationUserIds = conversationsData.map((conv: any) => conv.userId).filter((id: any) => id);
        
        // Fetch user info for all conversation partners
        if (conversationUserIds.length > 0) {
          const userInfoPromises = conversationUserIds.map(async (userId: string) => {
            try {
              const userResponse = await userApi.get(`/api/users/${userId}`);
              const convData = conversationsData.find((c: any) => c.userId === userId);
              return {
                user: userResponse.data,
                lastMessage: convData?.lastMessage
              };
            } catch (error) {
              console.log(`[ChatScreen] Could not fetch user info for ${userId}`);
              return null;
            }
          });
          
          const userInfos = await Promise.all(userInfoPromises);
          conversationUsers = userInfos
            .filter((item: any) => item && item.user && item.user.id)
            .map((item: any) => ({
              id: String(item.user.id),
              username: item.user.username || item.user.userName || 'Unknown',
              avatarUrl: item.user.avatarUrl || item.user.profileImageUrl,
              isFollowing: false,
              lastMessageData: item.lastMessage,
              lastMessageTime: item.lastMessage?.sentAt || item.lastMessage?.createdAt
            }));
          
          console.log('[ChatScreen] Fetched user info for', conversationUsers.length, 'conversation partners');
        }
      } catch (error: any) {
        console.log('[ChatScreen] Could not fetch conversations from backend:', error?.message || error);
        // Fallback: extract from existing state if backend endpoint doesn't work yet
        const conversationUserIds = new Set<string>();
        Object.keys(conversations).forEach((conversationId) => {
          const messages = conversations[conversationId];
          if (messages && messages.length > 0) {
            const parts = conversationId.split(':');
            if (parts.length === 2) {
              const otherUserId = parts[0] === user.id ? parts[1] : parts[0];
              if (otherUserId && otherUserId !== user.id) {
                conversationUserIds.add(otherUserId);
              }
            }
          }
        });
        console.log('[ChatScreen] Fallback: Found', conversationUserIds.size, 'users from existing conversations state');
      }
      
      // Combine following users and conversation users, removing duplicates
      const allUserIds = new Set<string>();
      const combinedUsers: any[] = [];
      
      // Add following users first
      followingUsers.forEach((u: any) => {
        if (u.id && !allUserIds.has(String(u.id))) {
          allUserIds.add(String(u.id));
          combinedUsers.push({ ...u, isFollowing: true });
        }
      });
      
      // Add conversation users that aren't already in the list
      conversationUsers.forEach((u: any) => {
        if (u.id && !allUserIds.has(String(u.id))) {
          allUserIds.add(String(u.id));
          combinedUsers.push({ ...u, isFollowing: false });
        }
      });
      
      console.log('[ChatScreen] Total unique contacts:', combinedUsers.length, '(following:', followingUsers.length, ', conversations:', conversationUsers.length, ')');

      // Fetch last message for each conversation
      const contactsWithMessages = await Promise.all(
        combinedUsers.map(async (contactUser: any) => {
          const contactId = contactUser.id;
          const conversationId = getConversationId(contactId);

          // Initialize contact with default values
          const contact: ChatContact = {
            id: contactId,
            name: contactUser.username,
            avatar: contactUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(contactUser.username)}`,
            lastMessage: "Start a conversation!",
            lastMessageTime: contactUser.lastMessageTime || "",
            unreadCount: 0,
            isOnline: false,
            isFollowing: contactUser.isFollowing !== false
          };

          // If we have last message data from conversations endpoint, use it
          if (contactUser.lastMessageData) {
            const lastMsg = contactUser.lastMessageData;
            const messageType = lastMsg.messageType || 'text';
            const messageText = lastMsg.text || lastMsg.message || '';
            
            if (messageType === 'voice') {
              contact.lastMessage = 'Voice message';
            } else if (messageType === 'image') {
              contact.lastMessage = 'Image';
            } else if (messageType === 'video') {
              contact.lastMessage = 'Video';
            } else if (messageText) {
              contact.lastMessage = messageText.length > 50
                ? messageText.substring(0, 50) + '...'
                : messageText;
            }
            
            if (contactUser.lastMessageTime) {
              contact.lastMessageTime = contactUser.lastMessageTime;
            }
          }

          // Try to fetch messages for this conversation to get last message and unread count
          try {
            const historyResponse = await chatApi.get(endpoints.chatHistory(user.id, contactId, 1, 50));
            const messages = Array.isArray(historyResponse.data)
              ? historyResponse.data
              : (historyResponse.data?.items || historyResponse.data?.data || []);

            if (messages.length > 0) {
              const sortedMessages = [...messages].sort((a, b) => {
                const timeA = new Date(a.sentAt || a.createdAt).getTime();
                const timeB = new Date(b.sentAt || b.createdAt).getTime();
                if (isNaN(timeA) || isNaN(timeB)) return 0;
                return timeB - timeA;
              });
              const lastMsg = sortedMessages[0];

              let timestamp: string = "";
              if (lastMsg.sentAt) {
                timestamp = typeof lastMsg.sentAt === 'string'
                  ? lastMsg.sentAt
                  : new Date(lastMsg.sentAt).toISOString();
              } else if (lastMsg.createdAt) {
                timestamp = typeof lastMsg.createdAt === 'string'
                  ? lastMsg.createdAt
                  : new Date(lastMsg.createdAt).toISOString();
              }

              if (timestamp && !isNaN(new Date(timestamp).getTime())) {
                contact.lastMessageTime = timestamp;

                const messageType = lastMsg.messageType || 'text';
                const messageText = lastMsg.text || lastMsg.message || '';

                if (messageType === 'voice') {
                  contact.lastMessage = 'Voice message';
                } else if (messageType === 'image') {
                  contact.lastMessage = 'Image';
                } else if (messageType === 'video') {
                  contact.lastMessage = 'Video';
                } else if (messageText) {
                  contact.lastMessage = messageText.length > 50
                    ? messageText.substring(0, 50) + '...'
                    : messageText;
                }

                // Calculate unread count (messages not from current user and not read)
                // Only count messages from other user that are NOT read (read !== true)
                contact.unreadCount = messages.filter((m: any) => {
                  const senderId = m.userId || m.senderId || m.fromUserId;
                  const isFromOtherUser = senderId !== user.id;
                  // Message is unread if read field is not explicitly true
                  // Message is read only if read field is explicitly true
                  const readStatus = m.read === true || m.isRead === true;
                  const isUnread = !readStatus; // false, undefined, or missing means unread
                  const shouldCount = isFromOtherUser && isUnread;
                  if (shouldCount) {
                    console.log(`[ChatScreen] Unread message from ${contact.name}:`, {
                      messageId: m.id,
                      senderId,
                      read: m.read,
                      isRead: m.isRead,
                      text: m.text?.substring(0, 20)
                    });
                  }
                  return shouldCount;
                }).length;
                console.log(`[ChatScreen] Calculated unread count for ${contact.name}: ${contact.unreadCount} unread out of ${messages.length} total messages`);
              }
            }
          } catch (error: any) {
            // If no messages exist (404) or other error, keep default "Start a conversation!"
            console.log(`No messages found for conversation ${conversationId} or error:`, error?.response?.status || error?.message);
          }

          return contact;
        })
      );

      // Sort contacts by last message time (most recent first)
      const sortedContacts = sortContactsByTime(contactsWithMessages);
      console.log('[ChatScreen] Sorted contacts:', sortedContacts.map(c => ({
        name: c.name,
        lastMessageTime: c.lastMessageTime,
        unreadCount: c.unreadCount
      })));

      setContacts(sortedContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      // Fallback to empty array if API fails
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId: string): Promise<ChatMessage[]> => {
    if (!user?.id) return [];

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

        let timestamp: string;
        let parsedDate: Date | null = null;

        const parseTimestamp = (ts: any): Date | null => {
          if (!ts) return null;

          let date: Date;
          if (typeof ts === 'string') {
            if (ts.trim() === '' || ts === '0001-01-01T00:00:00.0000000+00:00' || ts.includes('0001-01-01')) {
              return null;
            }
            date = new Date(ts);
            if (isNaN(date.getTime())) {
              const num = parseInt(ts, 10);
              if (!isNaN(num) && num > 0) {
                date = new Date(num);
              } else {
                return null;
              }
            }
          } else if (typeof ts === 'number') {
            if (ts <= 0) return null;
            date = new Date(ts);
          } else {
            date = new Date(ts);
          }

          if (isNaN(date.getTime()) || date.getTime() <= 0) {
            return null;
          }

          const year = date.getFullYear();
          if (year < 2000 || year > 2100) {
            return null;
          }

          return date;
        };

        const rawSentAt = msg.sentAt;
        const rawCreatedAt = msg.createdAt;

        parsedDate = parseTimestamp(rawSentAt) || parseTimestamp(rawCreatedAt);

        if (parsedDate) {
          timestamp = parsedDate.toISOString();
        } else {
          const rawTimestamp = rawSentAt || rawCreatedAt;
          if (rawTimestamp && typeof rawTimestamp === 'string') {
            if (rawTimestamp.includes('0001-01-01') || rawTimestamp.trim() === '') {
              if (messagesArray.indexOf(msg) < 3) {
                console.warn('[ChatScreen] Invalid timestamp (MinValue) for message:', msg.id, 'raw:', rawTimestamp);
              }
              timestamp = '';
            } else {
              timestamp = rawTimestamp;
            }
          } else if (rawTimestamp && typeof rawTimestamp === 'number' && rawTimestamp > 946684800000) {
            timestamp = new Date(rawTimestamp).toISOString();
          } else {
            if (messagesArray.indexOf(msg) < 3) {
              console.warn('[ChatScreen] No valid timestamp for message:', msg.id, 'sentAt:', rawSentAt, 'createdAt:', rawCreatedAt);
            }
            timestamp = '';
          }
        }

        if (messagesArray.indexOf(msg) < 3) {
          console.log('Message timestamp parsed:', {
            id: msg.id,
            rawSentAt: msg.sentAt,
            rawCreatedAt: msg.createdAt,
            finalTimestamp: timestamp,
            parsedDate: timestamp ? new Date(timestamp).toISOString() : 'INVALID'
          });
        }

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

        // Extract message type and media fields - check multiple possible field names
        let messageType = msg.messageType || (msg.customData?.messageType) || 'text';
        const messageText = msg.text || msg.message || '';

        // Extract call-specific fields if this is a call message
        const callType = msg.callType || (msg.customData?.callType);
        const callStatus = msg.callStatus || (msg.customData?.callStatus);
        const callDuration = msg.callDuration !== undefined ? msg.callDuration : (msg.customData?.callDuration);

        // Log call messages for debugging
        if (messageType === 'call') {
          console.log('[ChatScreen] Found call message:', {
            id: msg.id,
            callType,
            callStatus,
            callDuration,
            rawMsg: msg
          });
        }

        // Auto-detect image/video/YouTube from URL if messageType is not set
        if (messageType === 'text' && messageText) {
          if (looksLikeImageUrl(messageText)) {
            messageType = 'image';
          } else if (isYouTubeUrl(messageText)) {
            messageType = 'video';
          } else if (looksLikeVideoUrl(messageText)) {
            messageType = 'video';
          }
        }

        const audioUrl = msg.audioUrl || (msg.customData?.audioUrl) || null;
        const audioDuration = msg.audioDuration !== undefined && msg.audioDuration !== null
          ? msg.audioDuration
          : (msg.customData?.audioDuration !== undefined && msg.customData?.audioDuration !== null
            ? msg.customData.audioDuration
            : null);
        const imageUrl = msg.imageUrl || (msg.customData?.imageUrl) || (messageType === 'image' ? messageText : null);
        const videoUrl = msg.videoUrl || (msg.customData?.videoUrl) || (messageType === 'video' ? messageText : null);

        if (messageType === 'voice') {
          console.log('[ChatScreen] ✓ Voice message detected:', {
            id: msg.id,
            messageType,
            audioUrl,
            audioDuration,
            willBeDisplayed: !!(audioUrl && audioDuration)
          });
        } else if (messageType === 'image' || messageType === 'video') {
          console.log('[ChatScreen] ✓ Media message detected:', {
            id: msg.id,
            messageType,
            imageUrl: imageUrl || messageText,
            willBeDisplayed: !!(imageUrl || messageText)
          });
        }

        const finalTimestamp = timestamp || (rawSentAt && typeof rawSentAt === 'string' && !rawSentAt.includes('0001-01-01') ? rawSentAt : (rawCreatedAt && typeof rawCreatedAt === 'string' && !rawCreatedAt.includes('0001-01-01') ? rawCreatedAt : ''));

        return {
          id: msg.id || msg.messageId,
          userId: msg.userId || msg.senderId,
          senderId: msg.userId || msg.senderId,
          username: msg.username || msg.senderName || 'Unknown',
          text: messageText,
          sentAt: timestamp || msg.sentAt || msg.createdAt,
          createdAt: timestamp || msg.createdAt || msg.sentAt,
          messageType,
          audioUrl,
          audioDuration,
          imageUrl,
          videoUrl,
          replyToMessageId: msg.replyToMessageId || undefined,
          reactions: msg.reactions || {},
          read: msg.read || msg.isRead || false,
          // Include call-specific fields
          ...(messageType === 'call' && {
            callType,
            callStatus,
            callDuration
          })
        } as ChatMessage;
      });

      messagesData.sort((a, b) => {
        const timeA = new Date(a.sentAt || a.createdAt).getTime();
        const timeB = new Date(b.sentAt || b.createdAt).getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;
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
      // Trigger scroll for initial load
      updateConversationMessages(conversationId, messagesData, true);
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

      // Update contact's last message from fetched messages and calculate unread count
      if (messagesData.length > 0) {
        const lastMessage = messagesData[messagesData.length - 1]; // Messages are sorted by time
        const lastMessagePreview = lastMessage.messageType === 'voice'
          ? 'Voice message'
          : lastMessage.messageType === 'image'
            ? 'Image'
            : lastMessage.messageType === 'video'
              ? 'Video'
              : lastMessage.text;
        const lastMessageTime = lastMessage.sentAt || lastMessage.createdAt;

        // Calculate unread count - only count messages from other user that are NOT read
        const unreadCount = messagesData.filter((m: ChatMessage) => {
          const senderId = m.userId;
          const isFromOtherUser = senderId !== user?.id;
          // Message is unread if read field is false, undefined, or doesn't exist
          // Message is read only if read field is explicitly true
          const readStatus = m.read === true;
          return isFromOtherUser && !readStatus;
        }).length;

        setContacts(prev => {
          const updated = prev.map(contact =>
            contact.id === contactId
              ? {
                ...contact,
                lastMessage: lastMessagePreview,
                lastMessageTime: lastMessageTime,
                unreadCount: unreadCount
              }
              : contact
          );
          // Sort contacts by last message time (most recent first)
          return sortContactsByTime(updated);
        });
      }

      // Return the fetched messages
      return messagesData;
    } catch (error: any) {
      console.log('Error fetching messages:', error);
      console.log('Error response:', error.response?.data);
      console.log('Error status:', error.response?.status);
      // Fallback to empty array if API fails
      const conversationId = getConversationId(contactId);
      updateConversationMessages(conversationId, []);
      return [];
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

  // Pick image for custom wallpaper
  const pickCustomWallpaper = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCustomWallpaperUri(result.assets[0].uri);
        if (!customWallpaperName) {
          // Extract filename from URI if available
          const uriParts = result.assets[0].uri.split('/');
          const filename = uriParts[uriParts.length - 1];
          setCustomWallpaperName(filename.replace(/\.[^/.]+$/, '') || 'Custom Wallpaper');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Upload custom wallpaper
  const uploadCustomWallpaper = async () => {
    if (!customWallpaperUri || !user?.id) return;

    setUploadingWallpaper(true);
    try {
      // Create FormData
      const formData = new FormData();

      const fileUri = customWallpaperUri;
      const filename = fileUri.split('/').pop() || 'wallpaper.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';
      const fileName = customWallpaperName
        ? `${customWallpaperName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${match ? match[1] : 'jpg'}`
        : `wallpaper_${Date.now()}.${match ? match[1] : 'jpg'}`;

      // Handle web platform - convert data URIs and blob URIs to File objects
      if (Platform.OS === 'web') {
        try {
          let file: File;

          if (fileUri.startsWith('data:')) {
            // Convert base64 data URI to Blob, then to File
            const base64Data = fileUri.split(',')[1];
            const mimeType = fileUri.split(',')[0].split(':')[1].split(';')[0];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || fileType });
            file = new File([blob], fileName, { type: mimeType || fileType });
          } else if (fileUri.startsWith('blob:')) {
            // Convert blob URI to File
            const response = await fetch(fileUri);
            const blob = await response.blob();
            file = new File([blob], fileName, { type: fileType });
          } else {
            // For other URIs, try to fetch and convert
            const response = await fetch(fileUri);
            const blob = await response.blob();
            file = new File([blob], fileName, { type: fileType });
          }

          formData.append('file', file);
        } catch (webError: any) {
          console.error('[ChatScreen] Failed to convert URI to File on web:', webError);
          // Fallback: try to append as-is (might not work, but better than nothing)
          formData.append('file', fileUri);
        }
      } else {
        // Mobile platforms - use React Native FormData format
        // @ts-ignore - FormData typing issue
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);
      }

      formData.append('userId', user.id);
      if (customWallpaperName) {
        formData.append('name', customWallpaperName);
      }
      if (customWallpaperDescription) {
        formData.append('description', customWallpaperDescription);
      }
      formData.append('category', 'custom');
      formData.append('supportsDark', 'true');
      formData.append('supportsLight', 'true');

      // On web, don't set Content-Type header - let axios set it with the boundary
      // On mobile, we can set it explicitly
      const headers = Platform.OS === 'web'
        ? {}
        : { 'Content-Type': 'multipart/form-data' };

      await chatApi.post(endpoints.uploadCustomWallpaper, formData, { headers });

      // Reset form
      setCustomWallpaperUri(null);
      setCustomWallpaperName('');
      setCustomWallpaperDescription('');
      setShowCustomWallpaperUpload(false);

      // Refresh wallpapers list
      await fetchWallpapers();

      Alert.alert('Success', 'Wallpaper uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading wallpaper:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload wallpaper. Please try again.');
    } finally {
      setUploadingWallpaper(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await userApi.get(endpoints.searchUsers(query, 1, 20));
      const users = Array.isArray(response.data)
        ? response.data
        : (response.data?.items || response.data?.data || []);
      
      // Filter out current user and format as ChatContact
      const formattedResults = users
        .filter((u: any) => u.id !== user?.id)
        .map((u: any) => ({
          id: u.id,
          name: u.username || u.name || 'Unknown',
          avatar: u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username || u.name || 'Unknown')}`,
          lastMessage: "Start a conversation!",
          lastMessageTime: "",
          unreadCount: 0,
          isOnline: false,
          isFollowing: false
        }));
      
      setSearchResults(formattedResults);
      setShowSearchResults(true);
    } catch (error: any) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleContactSelect = async (contact: ChatContact) => {
    console.log('[ChatScreen] Contact selected:', contact.name);

    // IMPORTANT: Set conversation ID and selected contact FIRST before fetching
    const conversationId = getConversationId(contact.id);
    
    // Reset scroll tracking for this conversation to ensure we scroll on first load
    hasScrolledToEndRef.current[conversationId] = false;
    setShouldScrollToEnd(null); // Clear any pending scroll
    
    setCurrentConversationId(conversationId);
    setSelectedContact(contact);
    setShowContacts(false);
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);

    // Add contact to list if not already present, or update unread count to 0
    setContacts(prev => {
      const existingContact = prev.find(c => c.id === contact.id);
      if (existingContact) {
        // Update existing contact
        return prev.map(c =>
          c.id === contact.id ? { ...c, unreadCount: 0 } : c
        );
      } else {
        // Add new contact to the list
        return sortContactsByTime([...prev, { ...contact, unreadCount: 0 }]);
      }
    });

    // Fetch messages - this will update the conversations state
    console.log('[ChatScreen] Fetching messages for conversation:', conversationId);
    const fetchedMessages = await fetchMessages(contact.id);
    console.log('[ChatScreen] Fetched', fetchedMessages?.length || 0, 'messages');

    // The scroll will be triggered by the updateConversationMessages call with triggerScroll=true
    // No need for additional scroll logic here as it's handled by the useEffect

    // Load wallpaper
    await loadWallpaper(contact.id);

    // Mark unread messages as read immediately after fetching
    if (fetchedMessages && fetchedMessages.length > 0 && user?.id && contact.id) {
      try {
        // Filter unread messages from the fetched messages
        const unreadMessages = fetchedMessages.filter(m =>
          m.userId !== user.id && m.read !== true
        );

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map(m => m.id);
          console.log(`[ChatScreen] Marking ${messageIds.length} messages as read for contact ${contact.name}`);

          // Mark messages as read on the backend
          await markMessagesRead(contact.id, messageIds);

          // Update conversations state to mark messages as read
          setConversations(prev => ({
            ...prev,
            [conversationId]: prev[conversationId]?.map(m =>
              messageIds.includes(m.id) ? { ...m, read: true } : m
            ) || []
          }));

          // Ensure unread count is 0
          setContacts(prev => prev.map(c =>
            c.id === contact.id ? { ...c, unreadCount: 0 } : c
          ));

          // Update notification badge in real-time
          updateContactUnreadCount(contact.id);
        }
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
        // On error, recalculate unread count from fetched messages
        const unreadCount = fetchedMessages.filter((m: ChatMessage) => {
          const isFromOtherUser = m.userId !== user?.id;
          return isFromOtherUser && m.read !== true;
        }).length;
        setContacts(prev => prev.map(c =>
          c.id === contact.id ? { ...c, unreadCount } : c
        ));
      }
    }
  };

  const handleSendMessage = async () => {
    try {
      if (!inputText.trim() && !editingId && !pendingAttachment) return;
      if (!user?.id) return;
      if (!connected) {
        setError('Connection lost. Please wait for reconnection...');
        return;
      }

      if (editingId) {
        // Prevent editing images, videos, voice messages, or GIF messages
        const messageToEdit = currentMessages.find(m => m.id === editingId);
        if (messageToEdit) {
          const isImage = messageToEdit.messageType === 'image' || (messageToEdit.text && looksLikeImageUrl(messageToEdit.text));
          const isVideo = messageToEdit.messageType === 'video' || (messageToEdit.text && (looksLikeVideoUrl(messageToEdit.text) || isYouTubeUrl(messageToEdit.text)));
          const isVoice = messageToEdit.messageType === 'voice';
          const isGif = messageToEdit.text && looksLikeGifMessage(messageToEdit.text);

          if (isImage || isVideo || isVoice || isGif) {
            setError('Cannot edit images, videos, voice messages, or GIF messages.');
            setEditingId(null);
            setInputText("");
            return;
          }
        }

        // Edit existing message
        const newText = inputText.trim();
        const originalText = messageToEdit?.text || '';
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
          // Message is updated via SignalR, no need for HTTP endpoint
        } catch (error) {
          console.error('Failed to edit message:', error);
          setError('Failed to edit message. Please try again.');
          // Revert optimistic update on error
          if (currentConversationId) {
            setConversations(prev => ({
              ...prev,
              [currentConversationId]: prev[currentConversationId]?.map(m =>
                m.id === editingId ? { ...m, text: originalText } : m
              ) || []
            }));
          }
        }
        return;
      }

      // Handle media attachment - send URL as text message (backend auto-detects image/video)
      if (pendingAttachment) {
        const attachment = pendingAttachment;
        setPendingAttachment(null);

        // Update contact list immediately for media messages
        if (selectedContact) {
          const serverTimestamp = new Date().toISOString();
          const mediaPreview = attachment.mediaType === 'image' ? 'Image' : 'Video';

          setContacts(prev => {
            const updated = prev.map(contact =>
              contact.id === selectedContact.id
                ? { ...contact, lastMessage: mediaPreview, lastMessageTime: serverTimestamp }
                : contact
            );
            // Sort contacts by last message time (most recent first)
            return sortContactsByTime(updated);
          });
        }

        // Send the URL as a regular text message - backend will auto-detect it as image/video
        await sendText(attachment.url);
        setInputText('');
        setReplyTo(null);
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

  const handleEmojiSelect = (emoji: string) => {
    // Append emoji to input text (don't close picker for multiple selections)
    setInputText(prev => prev + emoji);
  };

  const handleGifSelect = async (gifUrl: string, gifTitle: string) => {
    try {
      if (!user?.id || !selectedContact?.id) {
        setError('Missing user or contact ID');
        return;
      }

      if (!connected) {
        setError('Connection lost. Please wait for reconnection...');
        return;
      }

      // Format GIF message same as web: ![GIF](url)
      const gifMessage = `![GIF](${gifUrl})`;

      const id = Date.now().toString();
      const serverTimestamp = new Date().toISOString();
      const newMessage: ChatMessage = {
        id,
        text: gifMessage,
        userId: user.id,
        username: user.username || 'You',
        createdAt: serverTimestamp,
        messageType: 'text',
      };

      if (currentConversationId) {
        addMessageToConversation(currentConversationId, newMessage);
      }

      // Update contact list
      if (selectedContact) {
        setContacts(prev => {
          const updated = prev.map(contact =>
            contact.id === selectedContact.id
              ? { ...contact, lastMessage: 'GIF', lastMessageTime: serverTimestamp }
              : contact
          );
          return sortContactsByTime(updated);
        });
      }

      // Send the GIF message
      await sendToUserWithMeta(selectedContact.id, gifMessage, undefined, id);
      setShowEmojiGifPicker(false);
    } catch (error) {
      console.error('Failed to send GIF:', error);
      setError('Failed to send GIF. Please try again.');
      setShowEmojiGifPicker(false);
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

  const uploadImageOrVideo = async (uri: string, mediaType: 'image' | 'video'): Promise<string | null> => {
    try {
      if (!user?.id || !selectedContact?.id) {
        console.error('Missing user or contact ID');
        return null;
      }

      const formData = new FormData();
      const extension = mediaType === 'image' ? 'jpg' : 'mp4';
      const fileName = `${mediaType}_${Date.now()}.${extension}`;
      const fileType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';

      // Handle web platform - convert data URIs and blob URIs to File objects
      if (Platform.OS === 'web') {
        try {
          let file: File;

          if (uri.startsWith('data:')) {
            // Convert base64 data URI to Blob, then to File
            const base64Data = uri.split(',')[1];
            const mimeType = uri.split(',')[0].split(':')[1].split(';')[0];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || fileType });
            file = new File([blob], fileName, { type: mimeType || fileType });
          } else if (uri.startsWith('blob:')) {
            // Convert blob URI to File
            const response = await fetch(uri);
            const blob = await response.blob();
            file = new File([blob], fileName, { type: fileType });
          } else {
            // For other URIs, try to fetch and convert
            const response = await fetch(uri);
            const blob = await response.blob();
            file = new File([blob], fileName, { type: fileType });
          }

          console.log('[ChatScreen] Created File object:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
          });
          formData.append('file', file);

          // Verify the file was appended
          if (formData.has('file')) {
            console.log('[ChatScreen] File successfully appended to FormData');
          } else {
            console.error('[ChatScreen] File was NOT appended to FormData!');
          }
        } catch (webError: any) {
          console.error('[ChatScreen] Failed to convert URI to File on web:', webError);
          // Fallback: try to append as-is (might not work, but better than nothing)
          formData.append('file', uri);
        }
      } else {
        // Mobile platforms - use React Native FormData format
        // @ts-ignore - FormData typing issue
        formData.append('file', {
          uri: uri,
          name: fileName,
          type: fileType,
        } as any);
      }

      console.log('[ChatScreen] Uploading media file:', { uri, mediaType, fileName, platform: Platform.OS });

      // On web, don't set Content-Type header - let axios set it with the boundary
      // On mobile, we can set it explicitly
      const headers = Platform.OS === 'web'
        ? {}
        : { 'Content-Type': 'multipart/form-data' };

      const response = await chatApi.post(endpoints.uploadChatMedia, formData, {
        headers,
      });

      console.log('[ChatScreen] Media upload response:', response.data);
      return response.data?.url || null;
    } catch (error: any) {
      console.error('[ChatScreen] Failed to upload media file:', error);
      console.error('[ChatScreen] Error details:', error.response?.data || error.message);
      return null;
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaUrl = await uploadImageOrVideo(asset.uri, 'image');
        if (mediaUrl) {
          setPendingAttachment({ url: mediaUrl, mediaType: 'image', name: asset.fileName || 'image.jpg' });
          setShowAttachMenu(false);
        } else {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickVideo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your videos to send videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaUrl = await uploadImageOrVideo(asset.uri, 'video');
        if (mediaUrl) {
          setPendingAttachment({ url: mediaUrl, mediaType: 'video', name: asset.fileName || 'video.mp4' });
          setShowAttachMenu(false);
        } else {
          Alert.alert('Error', 'Failed to upload video. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
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
        text: 'Uploading voice message...',
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
        'Voice message',
        customData,
        replyTo?.id || null,
        clientMessageId
      );

      console.log('[ChatScreen] SignalR send result:', success);

      if (success) {
        // Add message to conversation optimistically
        // SignalR will send it back with the server ID, so we'll update it then
        const serverTimestamp = new Date().toISOString();
        const voiceMessage: ChatMessage = {
          id: clientMessageId,
          text: 'Voice message',
          userId: user.id,
          username: user.username || 'You',
          createdAt: serverTimestamp,
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

        // Immediately update contact list with the sent voice message and reorder
        if (selectedContact) {
          setContacts(prev => {
            const updated = prev.map(contact =>
              contact.id === selectedContact.id
                ? { ...contact, lastMessage: 'Voice message', lastMessageTime: serverTimestamp }
                : contact
            );
            // Sort contacts by last message time (most recent first)
            return sortContactsByTime(updated);
          });
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

      // Wait a bit for state to update after stopping
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check both the result and the state (state might be updated even if result is null)
      const uriToSend = recordingResult?.uri || recordedUri;
      const durationToSend = recordingResult?.duration || recordedDuration;

      if (uriToSend && durationToSend > 0) {
        // Minimum recording duration (like Telegram - 1 second)
        if (durationToSend < 1) {
          console.log('[ChatScreen] Recording too short');
          Alert.alert('Too Short', 'Voice message must be at least 1 second long.');
          await cancelRecording();
          setIsRecordingMode(false);
          setRecordingCanceled(false);
          return;
        }

        // Send voice message
        console.log('[ChatScreen] Sending voice message...', { uri: uriToSend, duration: durationToSend });
        await sendVoiceMessage(uriToSend, durationToSend);
        clearRecording();
        setIsRecordingMode(false);
        setRecordingCanceled(false);
        recordingStartedRef.current = false;
        recordButtonPressInRef.current = false;
      } else {
        console.log('[ChatScreen] No valid recording to send', { 
          recordingResult, 
          recordedUri, 
          recordedDuration,
          uriToSend,
          durationToSend
        });
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
    const serverTimestamp = new Date().toISOString();
    const newMessage: ChatMessage = {
      id,
      text: text.trim(),
      userId: user.id,
      username: user.username || 'You',
      createdAt: serverTimestamp,
      messageType: 'text',
      replyToMessageId: replyTo?.id ?? null,
    };

    console.log('[ChatScreen] Created message object:', { id, text: newMessage.text, userId: newMessage.userId });

    if (currentConversationId) {
      console.log('[ChatScreen] Adding message to conversation:', currentConversationId);
      addMessageToConversation(currentConversationId, newMessage);
    }

    // Immediately update contact list with the sent message and reorder
    if (selectedContact) {
      const targetId = selectedContact.id;
      const lastMessagePreview = text.trim().length > 50 ? text.trim().substring(0, 50) + '...' : text.trim();

      setContacts(prev => {
        const existingContact = prev.find(c => c.id === targetId);
        if (existingContact) {
          // Update existing contact
          const updated = prev.map(contact =>
            contact.id === targetId
              ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: serverTimestamp }
              : contact
          );
          // Sort contacts by last message time (most recent first)
          const sorted = sortContactsByTime(updated);
          console.log('[ChatScreen] Reordered contacts after sendText:', sorted.map(c => ({
            name: c.name,
            lastMessageTime: c.lastMessageTime
          })));
          return sorted;
        } else {
          // Add new contact to the list
          const newContact: ChatContact = {
            ...selectedContact,
            lastMessage: lastMessagePreview,
            lastMessageTime: serverTimestamp,
            unreadCount: 0
          };
          const sorted = sortContactsByTime([...prev, newContact]);
          console.log('[ChatScreen] Added new contact to list after sendText:', newContact.name);
          return sorted;
        }
      });

      console.log('[ChatScreen] Sending message to contact:', { targetId, contactName: selectedContact.name });
      if (targetId && typeof targetId === 'string') {
        const result = await sendToUserWithMeta(targetId, newMessage.text, replyTo?.id ?? undefined, id);
        console.log('[ChatScreen] sendToUserWithMeta result:', result);
        if (!result) {
          setError(t('chat.failedToSend', 'Failed to send message. Please try again.'));
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
        console.log('[ChatScreen] Removing reaction');
        const result = await unreactToMessage(messageId, emoji);
        console.log('[ChatScreen] Unreact result:', result);
      } else {
        console.log('[ChatScreen] Adding reaction');
        const result = await reactToMessage(messageId, emoji);
        console.log('[ChatScreen] React result:', result);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to react to message:', error);
      setError(t('chat.failedToReact', 'Failed to react to message. Please try again.'));
    }
    setEmojiMenuForId(null);
  };

  const handleDoubleTapLike = async (messageId: string) => {
    if (!user?.id) return;

    const likeEmoji = '❤️';
    const message = currentMessages.find(m => m.id === messageId);
    const hasLiked = message?.reactions?.[likeEmoji]?.includes(user.id);

    try {
      if (hasLiked) {
        await unreactToMessage(messageId, likeEmoji);
      } else {
        await reactToMessage(messageId, likeEmoji);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to toggle like:', error);
    }
  };

  const handleSwipeReply = (message: ChatMessage) => {
    setReplyTo(message);
  };

  const handleLongPressReaction = (messageId: string) => {
    console.log('[ChatScreen] Long press detected on message:', messageId);
  };


  // Handler for deleting messages - delete immediately without confirmation (like web)
  const handleDeleteMessage = async (messageId: string) => {
    console.log('[ChatScreen] handleDeleteMessage called with messageId:', messageId);
    if (!messageId) {
      console.error('[ChatScreen] handleDeleteMessage: messageId is empty');
      return;
    }

    try {
      console.log('[ChatScreen] Deleting message:', messageId);
      console.log('[ChatScreen] Current conversation ID:', currentConversationId);
      console.log('[ChatScreen] SignalR connected:', connected);

      // Remove from local state immediately for better UX
      if (currentConversationId) {
        setConversations(prev => {
          const updated = { ...prev };
          if (updated[currentConversationId]) {
            const beforeCount = updated[currentConversationId].length;
            updated[currentConversationId] = updated[currentConversationId].filter(m => m.id !== messageId);
            const afterCount = updated[currentConversationId].length;
            console.log('[ChatScreen] Removed message from local state. Before:', beforeCount, 'After:', afterCount);
          }
          return updated;
        });
      }

      // Try SignalR deletion first (if connected)
      if (connected) {
        try {
          const success = await deleteMessage(messageId);
          console.log('[ChatScreen] DeleteMessage SignalR result:', success);
          if (success) {
            console.log('[ChatScreen] Message deleted successfully via SignalR');
            return; // Success, exit early
          }
        } catch (signalRError: any) {
          console.error('[ChatScreen] SignalR deletion error:', signalRError);
          console.error('[ChatScreen] SignalR error details:', signalRError?.message || signalRError);
        }
      } else {
        console.log('[ChatScreen] SignalR not connected, skipping SignalR deletion');
      }

      // If SignalR deletion failed or not connected, try HTTP endpoint as fallback
      console.log('[ChatScreen] Trying HTTP endpoint for deletion');
      try {
        // Backend expects MessageId (capital M) not messageId
        const response = await chatApi.post(endpoints.deleteChatMessage, { MessageId: messageId });
        console.log('[ChatScreen] HTTP deletion response:', response.data);
        console.log('[ChatScreen] Message deleted via HTTP endpoint');
      } catch (httpError: any) {
        console.error('[ChatScreen] HTTP deletion also failed:', httpError);
        console.error('[ChatScreen] HTTP error details:', httpError?.response?.data || httpError?.message);
        console.error('[ChatScreen] HTTP error status:', httpError?.response?.status);
        // Message was already removed from local state, so just show a warning
        Alert.alert(t('chat.warning', 'Warning'), t('chat.messageRemovedLocally', 'Message was removed locally but may not have been deleted on the server. Please check your connection and try again.'));
      }
    } catch (error: any) {
      console.error('[ChatScreen] Failed to delete message:', error);
      console.error('[ChatScreen] Error stack:', error?.stack);
      Alert.alert(t('common.error', 'Error'), t('chat.failedToDelete', 'Failed to delete message. Please try again.'));
    }
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

  // Handler for swipe action on own messages (edit/delete)
  // Note: This is kept for compatibility but we now use direct onEditMessage/onDeleteMessage callbacks
  // We don't call onComplete here to allow the buttons to stay visible
  const handleSwipeAction = (message: ChatMessage, onComplete?: () => void) => {
    // Only allow swipe action on own messages
    const isOwnMessage = message.userId === user?.id || message.senderId === user?.id;
    if (!isOwnMessage) {
      onComplete?.();
      return;
    }

    // Don't call onComplete - let the buttons stay visible
    // The MessageBubble component handles showing/hiding buttons based on message type
    // The buttons will auto-hide after 5 seconds or when clicked
  };

  // Helper function to format timestamp for display
  const formatMessageTime = (timestamp: string): string => {
    if (!timestamp || timestamp === "" || timestamp.includes("0001-01-01")) {
      return "";
    }

    try {
      // Ensure UTC timestamps are properly parsed
      // If timestamp doesn't have timezone indicator, assume it's UTC if it looks like ISO format
      let timestampToParse = timestamp;
      if (typeof timestamp === 'string' && timestamp.includes('T') && !timestamp.includes('Z') && !timestamp.match(/[+-]\d{2}:\d{2}$/)) {
        // ISO format without timezone - assume UTC and append Z
        timestampToParse = timestamp + 'Z';
      }

      const date = new Date(timestampToParse);
      if (isNaN(date.getTime())) {
        return "";
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      // Today - show time
      if (diffDays === 0) {
        if (diffMins < 1) return t('chat.justNow', 'Just now');
        if (diffMins < 60) return `${diffMins}m`;
        return `${diffHours}h`;
      }

      // Yesterday
      if (diffDays === 1) {
        return t('chat.yesterday', 'Yesterday');
      }

      // This week - show day name
      if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      }

      // Older - show date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return "";
    }
  };

  const renderContact = ({ item }: { item: ChatContact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleContactSelect(item)}
    >
      <View style={styles.contactAvatar}>
        <SafeImage
          source={{ uri: item.avatar }}
          style={styles.avatarImage}
          fallbackUri={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.name)}`}
          placeholder={item.name?.charAt(0).toUpperCase() || 'U'}
        />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.lastMessageTime && item.lastMessageTime !== "" && !item.lastMessageTime.includes("0001-01-01") && (
            <Text style={styles.lastMessageTime}>{formatMessageTime(item.lastMessageTime)}</Text>
          )}
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      {(item.unreadCount !== undefined && item.unreadCount !== null && item.unreadCount > 0) && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>
            {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Video thumbnail component for reply previews
  const ReplyPreviewVideoThumbnail: React.FC<{ videoUrl: string; message: ChatMessage; isOwnMessage: boolean; compact: boolean }> = ({ videoUrl, message, isOwnMessage, compact }) => {
    const thumbnailPlayer = useVideoPlayer(videoUrl, (player) => {
      player.muted = true;
      player.loop = false;
    });

    return (
      <View style={[styles.replyPreview, compact && styles.replyPreviewCompact]}>
        <View style={[styles.replyLine, isOwnMessage && styles.ownReplyLine]} />
        <View style={styles.replyPreviewWithMedia}>
          <View style={styles.replyPreviewVideoContainer}>
            {/* Use VideoView to show first frame - works on all platforms */}
            <VideoView
              player={thumbnailPlayer}
              style={styles.replyPreviewVideo}
              nativeControls={false}
              fullscreenOptions={{ allowed: false }}
              allowsPictureInPicture={false}
              contentFit="cover"
            />
            <View style={styles.replyPreviewVideoPlayIcon}>
              <Text style={styles.replyPreviewVideoPlayIconText}>▶</Text>
            </View>
          </View>
              <Text style={[styles.replyText, isOwnMessage && styles.ownReplyText]} numberOfLines={1}>
                {message.text && !looksLikeVideoUrl(message.text) ? message.text : t('chat.video', 'Video')}
              </Text>
        </View>
      </View>
    );
  };

  // Video thumbnail component for inline reply previews (when typing)
  const ReplyPreviewVideoThumbnailInline: React.FC<{ videoUrl: string; message: ChatMessage }> = ({ videoUrl, message }) => {
    const thumbnailPlayer = useVideoPlayer(videoUrl, (player) => {
      player.muted = true;
      player.loop = false;
    });

    return (
      <View style={styles.replyPreviewWithMediaInline}>
        <View style={styles.replyPreviewVideoContainerInline}>
          {/* Use VideoView to show first frame - works on all platforms */}
          <VideoView
            player={thumbnailPlayer}
            style={styles.replyPreviewVideoInline}
            nativeControls={false}
            fullscreenOptions={{ allowed: false }}
            allowsPictureInPicture={false}
            contentFit="cover"
          />
          <View style={styles.replyPreviewVideoPlayIconInline}>
            <Text style={styles.replyPreviewVideoPlayIconTextInline}>▶</Text>
          </View>
        </View>
        <Text style={styles.replyPreviewText} numberOfLines={1}>
          {message.text && !looksLikeVideoUrl(message.text) ? message.text : t('chat.video', 'Video')}
        </Text>
      </View>
    );
  };

  // Reply preview component with image/video support
  const ReplyPreviewContent: React.FC<{ message: ChatMessage; isOwnMessage?: boolean; compact?: boolean }> = ({ message, isOwnMessage = false, compact = false }) => {
    const isImage = message.messageType === 'image' || (message.text && looksLikeImageUrl(message.text));
    const isVideo = message.messageType === 'video' || (message.text && (looksLikeVideoUrl(message.text) || isYouTubeUrl(message.text)));
    const imageUrl = message.imageUrl || (isImage ? message.text : null);
    const videoUrl = message.videoUrl || (isVideo ? message.text : null);

    if (isImage && imageUrl) {
      return (
        <View style={[styles.replyPreview, compact && styles.replyPreviewCompact]}>
          <View style={[styles.replyLine, isOwnMessage && styles.ownReplyLine]} />
          <View style={styles.replyPreviewWithMedia}>
            <SafeImage
              source={{ uri: imageUrl }}
              style={styles.replyPreviewImage}
              resizeMode="cover"
              placeholder=""
              fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Image`}
            />
            <Text style={[styles.replyText, isOwnMessage && styles.ownReplyText]} numberOfLines={1}>
              {message.text && !looksLikeImageUrl(message.text) ? message.text : t('chat.photo', 'Photo')}
            </Text>
          </View>
        </View>
      );
    }

    if (isVideo && videoUrl) {
      // Use VideoThumbnail for videos (same as main message display)
      // For YouTube videos, use the YouTube thumbnail
      if (isYouTubeUrl(videoUrl)) {
        const youtubeThumbnail = getYouTubeThumbnail(videoUrl);
        return (
          <View style={[styles.replyPreview, compact && styles.replyPreviewCompact]}>
            <View style={[styles.replyLine, isOwnMessage && styles.ownReplyLine]} />
            <View style={styles.replyPreviewWithMedia}>
              <View style={styles.replyPreviewVideoContainer}>
                <SafeImage
                  source={{ uri: youtubeThumbnail || videoUrl }}
                  style={styles.replyPreviewVideo}
                  resizeMode="cover"
                  placeholder="▶"
                  fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Video`}
                />
                <View style={styles.replyPreviewVideoPlayIcon}>
                  <Text style={styles.replyPreviewVideoPlayIconText}>▶</Text>
                </View>
              </View>
              <Text style={[styles.replyText, isOwnMessage && styles.ownReplyText]} numberOfLines={1}>
                {message.text && !isYouTubeUrl(message.text) ? message.text : t('chat.video', 'Video')}
              </Text>
            </View>
          </View>
        );
      }

      // For regular videos, use VideoThumbnail component from expo-video (same as VideoPlayerComponent)
      return (
        <ReplyPreviewVideoThumbnail
          videoUrl={videoUrl}
          message={message}
          isOwnMessage={isOwnMessage}
          compact={compact}
        />
      );
    }

    // Text message or voice message
    return (
      <View style={[styles.replyPreview, compact && styles.replyPreviewCompact]}>
        <View style={[styles.replyLine, isOwnMessage && styles.ownReplyLine]} />
        <Text style={[styles.replyText, isOwnMessage && styles.ownReplyText]} numberOfLines={1}>
          {message.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : (message.text || t('chat.message', 'Message'))}
        </Text>
      </View>
    );
  };

  // Full-screen video player component using expo-video
  const FullScreenVideoPlayer: React.FC<{ videoUrl: string; onClose: () => void }> = ({ videoUrl, onClose }) => {
    const player = useVideoPlayer(videoUrl, (player) => {
      player.muted = false;
      player.loop = false;
      player.play();
    });

    useEffect(() => {
      // Auto-play when component mounts
      if (player) {
        player.play();
      }

      return () => {
        // Cleanup: pause and reset when component unmounts
        if (player) {
          player.pause();
          player.currentTime = 0;
        }
      };
    }, [player]);

    return (
      <View style={styles.videoModalOverlay}>
        <TouchableOpacity
          style={styles.videoModalCloseButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <CloseIcon size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.videoModalContent}>
          <VideoView
            player={player}
            style={styles.videoModalPlayer}
            nativeControls={true}
            fullscreenOptions={{ allowed: true }}
            allowsPictureInPicture={false}
            contentFit="contain"
          />
        </View>
      </View>
    );
  };

  // Video player component with play button overlay
  // Uses expo-video VideoView to display the actual video (per expo-video documentation)
  // VideoView automatically shows the first frame when loaded, similar to web's preload="metadata"
  const VideoPlayerComponent: React.FC<{ videoUrl: string; messageId: string }> = ({ videoUrl, messageId }) => {
    // Create video player using expo-video (per documentation)
    // The player will automatically load and show the first frame
    const player = useVideoPlayer(videoUrl, (player) => {
      // Don't auto-play, just load the video to show first frame
      player.muted = true;
      player.loop = false;
    });

    if (!videoUrl || videoUrl.trim() === '') {
      return (
        <View style={styles.messageVideoPlaceholder}>
          <Text style={styles.messageVideoPlayIcon}>▶</Text>
          <Text style={{ color: colors.text, marginTop: 8 }}>Video unavailable</Text>
        </View>
      );
    }

    const handlePlay = () => {
      // Open video in full screen
      setEnlargedVideo(videoUrl);
    };

    return (
      <TouchableOpacity
        style={styles.messageVideoPlayerContainer}
        onPress={handlePlay}
        activeOpacity={0.9}
      >
        {/* Show VideoView to display the actual video */}
        {/* VideoView will automatically show the first frame when loaded */}
        <VideoView
          player={player}
          style={styles.messageVideoPlayer}
          nativeControls={false}
          fullscreenOptions={{ allowed: false }}
          allowsPictureInPicture={false}
        />

        {/* Play button overlay */}
        <View style={styles.videoPlayButtonOverlay}>
          <View style={styles.videoPlayButton}>
            <Text style={styles.videoPlayButtonIcon}>▶</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage | { type: 'dateDivider'; date: string; id: string } }) => {
    // Handle date divider
    if ('type' in item && item.type === 'dateDivider') {
      return (
        <View style={styles.dateDividerContainer}>
          <Text style={styles.dateDividerText}>{item.date}</Text>
        </View>
      );
    }
    
    // Handle regular message
    const message = item as ChatMessage;
    const isOwnMessage = message.userId === user?.id || message.senderId === user?.id;

    if (message.messageType === 'call') {
      const callType = (message as any).callType || 'audio';
      const callStatus = (message as any).callStatus || 'ended';
      const callDuration = (message as any).callDuration || 0;

      const isVideoCall = callType === 'video';
      const callIcon = isVideoCall ? '📹' : '📞';

      let statusText = '';
      let statusColor = colors.textSecondary;

      if (callStatus === 'answered' || callStatus === 'ended') {
        const durationText = callDuration > 0 ? ` (${formatCallDuration(callDuration)})` : '';
        statusText = isOwnMessage ? `Outgoing ${callType} call${durationText}` : `Incoming ${callType} call${durationText}`;
        statusColor = '#34c759';
      } else if (callStatus === 'rejected') {
        statusText = isOwnMessage ? 'Call declined' : 'Declined call';
        statusColor = '#ff3b30';
      } else if (callStatus === 'missed') {
        statusText = 'Missed call';
        statusColor = '#ff3b30';
      }

      return (
        <View style={styles.callMessageContainer}>
          <View style={[styles.callMessageBanner, { borderLeftColor: statusColor }]}>
            <Text style={styles.callMessageIcon}>{callIcon}</Text>
            <Text style={[styles.callMessageText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <Text style={styles.callMessageTime}>
            {new Date(message.sentAt || message.createdAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    const repliedToMessage = message.replyToMessageId ? currentMessages.find(m => m.id === message.replyToMessageId) || null : null;

    return (
      <MessageBubble
        message={message}
        isOwnMessage={isOwnMessage}
        currentUserId={user?.id || ''}
        repliedToMessage={repliedToMessage}
        onDoubleTap={handleDoubleTapLike}
        onSwipeReply={handleSwipeReply}
        onSwipeAction={handleSwipeAction}
        onEditMessage={(message) => {
          // Only allow editing text messages
          const messageType = message.messageType || 'text';
          const isImage = messageType === 'image' || (message.text && looksLikeImageUrl(message.text));
          const isVideo = messageType === 'video' || (message.text && (looksLikeVideoUrl(message.text) || isYouTubeUrl(message.text)));
          const isVoice = messageType === 'voice';
          const isCall = messageType === 'call';
          const isGif = message.text && looksLikeGifMessage(message.text);

          if (!isCall && !isVoice && !isImage && !isVideo && !isGif) {
            setEditingId(message.id);
            setInputText(message.text || '');
          }
        }}
        onDeleteMessage={(message) => {
          // Allow deleting all message types
          handleDeleteMessage(message.id);
        }}
        onLongPress={handleLongPressReaction}
        onReactionPress={handleReactToMessage}
        onImagePress={setEnlargedImage}
        onVideoPress={setEnlargedVideo}
        renderReplyPreview={(message, isOwn) => (
          <ReplyPreviewContent message={message} isOwnMessage={isOwn} />
        )}
        renderVideoPlayer={(videoUrl, messageId) => (
          <VideoPlayerComponent videoUrl={videoUrl} messageId={messageId} />
        )}
        looksLikeImageUrl={looksLikeImageUrl}
        looksLikeVideoUrl={looksLikeVideoUrl}
        isYouTubeUrl={isYouTubeUrl}
        getYouTubeThumbnail={getYouTubeThumbnail}
        looksLikeGifMessage={looksLikeGifMessage}
      />
    );
  };

  if (showContacts) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('chat.messages', 'Messages')}</Text>
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={() => {
              setSearchQuery('');
              setShowSearchResults(true);
            }}
          >
            <Text style={styles.newChatButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        {showSearchResults && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('chat.searchUsers', 'Search users...')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.trim().length >= 2) {
                  handleSearchUsers(text);
                } else {
                  setSearchResults([]);
                }
              }}
              autoFocus={true}
            />
            <TouchableOpacity
              style={styles.searchCancelButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
            >
              <Text style={styles.searchCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Results or Contacts List */}
        {showSearchResults ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            contentContainerStyle={styles.contactsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              isSearching ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('chat.searching', 'Searching...')}</Text>
                </View>
              ) : searchQuery.trim().length >= 2 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('chat.noUsersFound', 'No users found')}</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('chat.searchHint', 'Type at least 2 characters to search')}</Text>
                </View>
              )
            }
          />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            contentContainerStyle={styles.contactsList}
            showsVerticalScrollIndicator={false}
          />
        )}
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
          onPress={() => {
            setShowContacts(true);
            setShowSearchResults(false);
            setSearchQuery('');
            setSearchResults([]);
          }}
        >
          <BackIcon size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatHeaderInfo}
          onPress={() => {
            if (selectedContact?.id) {
              navigation.navigate('UserProfile', { userId: selectedContact.id });
            }
          }}
          activeOpacity={0.7}
        >
          <Image source={{ uri: selectedContact?.avatar }} style={styles.chatAvatar} />
          <View style={styles.chatUserInfo}>
            <Text style={styles.chatUserName}>{selectedContact?.name}</Text>
            <Text style={styles.chatUserStatus}>
              {selectedContact?.isOnline ? t('chat.online', 'Online') : t('chat.offline', 'Offline')}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.chatHeaderActions}>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleStartCall('audio')}
            disabled={!connected || !!activeCall}
          >
            <CallIcon size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleStartCall('video')}
            disabled={!connected || !!activeCall}
          >
            <VideoCallIcon size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.wallpaperButton}
            onPress={() => setShowWallpaperPicker(true)}
          >
            <PaletteIcon size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Incoming Call Modal - Telegram Style */}
      {incomingCall && !activeCall && (
        <View style={styles.incomingCallOverlay}>
          <View style={styles.incomingCallModal}>
            <View style={styles.incomingCallAvatarContainer}>
              <Image
                source={{ uri: contacts.find(c => c.id === incomingCall.callerUserId)?.avatar || '' }}
                style={styles.incomingCallAvatar}
              />
              <Text style={styles.incomingCallSubtitle}>
                {contacts.find(c => c.id === incomingCall.callerUserId)?.name || t('chat.unknown', 'Unknown')}
              </Text>
              <Text style={styles.incomingCallTitle}>
                {incomingCall.callType === 'video' ? t('chat.videoCall', 'Video Call') : t('chat.audioCall', 'Audio Call')}
              </Text>
            </View>
            <View style={styles.incomingCallButtons}>
              <TouchableOpacity
                style={[styles.callActionButton, styles.rejectCallButton]}
                onPress={handleRejectCall}
              >
                <CloseIcon size={32} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callActionButton, styles.acceptCallButton]}
                onPress={handleAcceptCall}
              >
                {incomingCall.callType === 'video' ? (
                  <VideoCallIcon size={32} color="white" />
                ) : (
                  <CallIcon size={32} color="white" />
                )}
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
                  {callDuration > 0 ? formatCallDuration(callDuration) : t('chat.connecting', 'Connecting...')}
                </Text>
                <View style={styles.callControlButtons}>
                  <TouchableOpacity
                    style={[styles.callControlButton, isMuted && styles.callControlButtonActive]}
                    onPress={toggleMute}
                  >
                    <MicIcon size={24} color="white" muted={isMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.callControlButton, !isVideoEnabled && styles.callControlButtonActive]}
                    onPress={toggleVideo}
                  >
                    <CameraIcon size={24} color="white" enabled={isVideoEnabled} />
                  </TouchableOpacity>
                  {isVideoEnabled && (
                    <TouchableOpacity
                      style={styles.callControlButton}
                      onPress={switchCamera}
                    >
                      <FlipCameraIcon size={24} color="white" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.callControlButton, styles.endCallButton]}
                    onPress={handleEndCall}
                  >
                    <CloseIcon size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            // Audio call UI - Telegram Style
            <View style={styles.activeCallModal}>
              <View style={styles.activeCallAvatarContainer}>
                <Image
                  source={{ uri: contacts.find(c => c.id === activeCall.otherUserId)?.avatar || '' }}
                  style={styles.activeCallAvatar}
                />
                <Text style={styles.activeCallSubtitle}>
                  {contacts.find(c => c.id === activeCall.otherUserId)?.name || t('chat.unknown', 'Unknown')}
                </Text>
              </View>
              {callDuration > 0 ? (
                <Text style={styles.callDurationText}>
                  {formatCallDuration(callDuration)}
                </Text>
              ) : (
                <View style={styles.connectingContainer}>
                  <Text style={styles.callStatusText}>{t('chat.connecting', 'Connecting...')}</Text>
                </View>
              )}
              <View style={styles.activeCallButtons}>
                <TouchableOpacity
                  style={[styles.callActionButton, isMuted && styles.callActionButtonActive]}
                  onPress={toggleMute}
                >
                  <MicIcon size={28} color="white" muted={isMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.callActionButton, styles.endCallButton]}
                  onPress={handleEndCall}
                >
                  <CloseIcon size={24} color="white" />
                  <Text style={styles.callActionButtonText}>{t('chat.end', 'End')}</Text>
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
          data={getMessagesWithDateDividers(currentMessages)}
          keyExtractor={(item) => ('type' in item && item.type === 'dateDivider') ? item.id : (item as ChatMessage).id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            // Always scroll to end when content size changes, especially on initial load
            if (currentConversationId && currentMessages.length > 0) {
              // Check if we should scroll (either triggered or haven't scrolled yet)
              const shouldScroll = shouldScrollToEnd === currentConversationId || 
                                 !hasScrolledToEndRef.current[currentConversationId];
              
              if (shouldScroll) {
                // Use requestAnimationFrame to ensure layout is complete
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: hasScrolledToEndRef.current[currentConversationId] });
                    hasScrolledToEndRef.current[currentConversationId] = true;
                    if (shouldScrollToEnd === currentConversationId) {
                      setShouldScrollToEnd(null);
                    }
                  }, 50);
                });
              }
            }
          }}
          onLayout={() => {
            // Also scroll on layout to catch initial render
            if (currentConversationId && currentMessages.length > 0) {
              const shouldScroll = shouldScrollToEnd === currentConversationId || 
                                 !hasScrolledToEndRef.current[currentConversationId];
              
              if (shouldScroll) {
                // For initial load, wait longer and don't animate
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: hasScrolledToEndRef.current[currentConversationId] });
                      hasScrolledToEndRef.current[currentConversationId] = true;
                      if (shouldScrollToEnd === currentConversationId) {
                        setShouldScrollToEnd(null);
                      }
                    }, 100);
                  });
                });
              }
            }
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>
                  {t('chat.typing', '{{name}} is typing...', { name: selectedContact?.name || '' })}
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
              <Text style={styles.wallpaperModalTitle}>{t('chat.chooseBackground', 'Choose Background')}</Text>
              <TouchableOpacity
                style={styles.wallpaperModalClose}
                onPress={() => {
                  setShowWallpaperPicker(false);
                  setShowCustomWallpaperUpload(false);
                  setCustomWallpaperUri(null);
                  setCustomWallpaperName('');
                  setCustomWallpaperDescription('');
                }}
              >
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Opacity Control */}
            <View style={styles.opacityControl}>
              <Text style={styles.opacityLabel}>{t('chat.opacity', 'Opacity: {{percent}}%', { percent: Math.round(wallpaperOpacity * 100) })}</Text>
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

            {/* Upload Custom Wallpaper Button */}
            <TouchableOpacity
              style={styles.uploadWallpaperButton}
              onPress={() => setShowCustomWallpaperUpload(!showCustomWallpaperUpload)}
            >
              <Text style={styles.uploadWallpaperButtonText}>
                {showCustomWallpaperUpload ? t('chat.hideUpload', 'Hide Upload') : t('chat.uploadYourOwn', 'Upload Your Own')}
              </Text>
            </TouchableOpacity>

            {/* Custom Wallpaper Upload Form */}
            {showCustomWallpaperUpload && (
              <View style={styles.uploadForm}>
                <TouchableOpacity
                  style={styles.uploadImageButton}
                  onPress={pickCustomWallpaper}
                >
                  {customWallpaperUri ? (
                    <Image
                      source={{ uri: customWallpaperUri }}
                      style={styles.uploadImagePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.uploadImagePlaceholder}>
                      <ImageIcon size={24} color={colors.text} />
                      <Text style={styles.uploadImagePlaceholderText}>
                        Choose Image
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TextInput
                  style={styles.uploadInput}
                  placeholder="Wallpaper Name (optional)"
                  placeholderTextColor={colors.muted}
                  value={customWallpaperName}
                  onChangeText={setCustomWallpaperName}
                />

                <TextInput
                  style={[styles.uploadInput, styles.uploadTextArea]}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.muted}
                  value={customWallpaperDescription}
                  onChangeText={setCustomWallpaperDescription}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  style={[
                    styles.uploadSubmitButton,
                    (!customWallpaperUri || uploadingWallpaper) && styles.uploadSubmitButtonDisabled
                  ]}
                  onPress={uploadCustomWallpaper}
                  disabled={!customWallpaperUri || uploadingWallpaper}
                >
                  <Text style={styles.uploadSubmitButtonText}>
                    {uploadingWallpaper ? 'Uploading...' : 'Upload Wallpaper'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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

      {/* Full-Screen Image Viewer Modal */}
      {enlargedImage && (
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setEnlargedImage(null)}
            activeOpacity={0.7}
          >
            <CloseIcon size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageModalContainer}
            activeOpacity={1}
            onPress={() => setEnlargedImage(null)}
          >
            <SafeImage
              source={{ uri: enlargedImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
              placeholder=""
              fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Image`}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Full-Screen Video Viewer Modal */}
      {enlargedVideo && (
        <FullScreenVideoPlayer
          videoUrl={enlargedVideo}
          onClose={() => {
            setEnlargedVideo(null);
            setVideoNaturalSize(null);
          }}
        />
      )}

      {/* Emoji/GIF Picker Modal */}
      <EmojiGifPickerModal
        isOpen={showEmojiGifPicker}
        initialTab={emojiGifPickerTab}
        onEmojiSelect={handleEmojiSelect}
        onGifSelect={handleGifSelect}
        onClose={() => setShowEmojiGifPicker(false)}
      />

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
              {(() => {
                const isImage = replyTo.messageType === 'image' || (replyTo.text && looksLikeImageUrl(replyTo.text));
                const isVideo = replyTo.messageType === 'video' || (replyTo.text && (looksLikeVideoUrl(replyTo.text) || isYouTubeUrl(replyTo.text)));
                const imageUrl = replyTo.imageUrl || (isImage ? replyTo.text : null);
                const videoUrl = replyTo.videoUrl || (isVideo ? replyTo.text : null);

                if (isImage && imageUrl) {
                  return (
                    <View style={styles.replyPreviewWithMediaInline}>
                      <SafeImage
                        source={{ uri: imageUrl }}
                        style={styles.replyPreviewImageInline}
                        resizeMode="cover"
                        placeholder=""
                        fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Image`}
                      />
                      <Text style={styles.replyPreviewText} numberOfLines={1}>
                        {replyTo.text && !looksLikeImageUrl(replyTo.text) ? replyTo.text : t('chat.photo', 'Photo')}
                      </Text>
                    </View>
                  );
                }

                if (isVideo && videoUrl) {
                  // For YouTube videos, use the YouTube thumbnail
                  if (isYouTubeUrl(videoUrl)) {
                    const youtubeThumbnail = getYouTubeThumbnail(videoUrl);
                    return (
                      <View style={styles.replyPreviewWithMediaInline}>
                        <View style={styles.replyPreviewVideoContainerInline}>
                          <SafeImage
                            source={{ uri: youtubeThumbnail || videoUrl }}
                            style={styles.replyPreviewVideoInline}
                            resizeMode="cover"
                            placeholder="▶"
                            fallbackUri={`https://api.dicebear.com/7.x/initials/svg?seed=Video`}
                          />
                          <View style={styles.replyPreviewVideoPlayIconInline}>
                            <Text style={styles.replyPreviewVideoPlayIconTextInline}>▶</Text>
                          </View>
                        </View>
                        <Text style={styles.replyPreviewText} numberOfLines={1}>
                          {replyTo.text && !isYouTubeUrl(replyTo.text) ? replyTo.text : t('chat.video', 'Video')}
                        </Text>
                      </View>
                    );
                  }

                  // For regular videos, use VideoThumbnail component (same as main message display)
                  return (
                    <ReplyPreviewVideoThumbnailInline videoUrl={videoUrl} message={replyTo} />
                  );
                }

                return (
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {replyTo.messageType === 'voice' ? t('chat.voiceMessage', 'Voice message') : (replyTo.text || t('chat.message', 'Message'))}
                  </Text>
                );
              })()}
            </View>
            <TouchableOpacity
              style={styles.replyPreviewClose}
              onPress={() => setReplyTo(null)}
            >
              <CloseIcon size={18} color={colors.text} />
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
            <Text style={styles.editIndicatorCancel}>{t('common.cancel', 'Cancel')}</Text>
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
              <CloseIcon size={20} color={colors.text} />
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
              <CheckIcon size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputWrapper}>
            {/* Attach Button */}
            <View style={styles.attachButtonContainer}>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={() => setShowAttachMenu(!showAttachMenu)}
                activeOpacity={0.7}
              >
                <Text style={styles.attachButtonText}>+</Text>
              </TouchableOpacity>
              {showAttachMenu && (
                <View style={styles.attachMenu}>
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={pickImage}
                  >
                    <ImageIcon size={24} color={colors.text} />
                    <Text style={styles.attachMenuText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={pickVideo}
                  >
                    <Text style={styles.attachMenuIcon}>🎬</Text>
                    <Text style={styles.attachMenuText}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={() => {
                      setShowAttachMenu(false);
                      setEmojiGifPickerTab('gif');
                      setShowEmojiGifPicker(true);
                    }}
                  >
                    <Text style={styles.attachMenuIcon}>🎞️</Text>
                    <Text style={styles.attachMenuText}>GIF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.attachMenuItem}
                    onPress={() => {
                      setShowAttachMenu(false);
                      setEmojiGifPickerTab('emoji');
                      setShowEmojiGifPicker(true);
                    }}
                  >
                    <EmojiIcon size={24} color={colors.text} />
                    <Text style={styles.attachMenuText}>Emoji</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Pending Attachment Preview */}
            {pendingAttachment && (
              <View style={styles.pendingAttachmentContainer}>
                {pendingAttachment.mediaType === 'image' ? (
                  <Image
                    source={{ uri: pendingAttachment.url }}
                    style={styles.pendingAttachmentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.pendingAttachmentVideo}>
                    <Text style={styles.pendingAttachmentVideoIcon}>▶</Text>
                    <Text style={styles.pendingAttachmentVideoText}>Video</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.pendingAttachmentRemove}
                  onPress={() => setPendingAttachment(null)}
                >
                  <CloseIcon size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            {/* Record Button (when input is empty) */}
            {!inputText.trim() && !editingId && !pendingAttachment && (
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
                <VoiceMessageIcon size={24} color={colors.text} />
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
              style={[styles.sendButton, (!inputText.trim() && !editingId && !pendingAttachment) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() && !editingId && !pendingAttachment}
            >
              <LinearGradient
                colors={(inputText.trim() || editingId || pendingAttachment) ? [colors.gradientStart, colors.gradientMid, colors.gradientEnd] : [colors.muted, colors.muted]}
                style={styles.sendButtonGradient}
              >
                {editingId ? (
                  <CheckIcon size={20} color={colors.text} />
                ) : (
                  <SendIcon size={20} color={colors.text} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: 'light' | 'dark') => StyleSheet.create({
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  searchCancelButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  searchCancelText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Contacts list styles
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
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
    marginRight: 4,
  },
  callButtonText: {
    fontSize: 18,
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
  messageImageContainer: {
    position: 'relative',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  messageVideoContainer: {
    marginVertical: 4,
  },
  messageVideoPlaceholder: {
    width: 250,
    height: 200,
    backgroundColor: colors.muted,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageVideoPlayIcon: {
    fontSize: 48,
    color: colors.text,
    marginBottom: 8,
  },
  messageVideoText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  messageVideoPlayerContainer: {
    position: 'relative',
    width: 250,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    zIndex: 1,
  },
  messageVideoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  videoPlayButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 10,
  },
  videoPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  videoPlayButtonIcon: {
    fontSize: 32,
    color: 'white',
    marginLeft: 4, // Slight offset to center the play icon visually
  },
  youtubeContainer: {
    position: 'relative',
    width: 250,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  youtubeThumbnail: {
    width: '100%',
    height: '100%',
  },
  youtubeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  youtubePlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  youtubePlayIcon: {
    fontSize: 24,
    color: 'white',
    marginLeft: 4,
  },
  youtubeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 8,
    textAlignVertical: 'top',
    marginHorizontal: 4,
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
  replyPreviewLine: {
    width: 3,
    backgroundColor: colors.primary,
    marginRight: 8,
    alignSelf: 'stretch',
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
  replyPreviewWithMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  replyPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.muted,
  },
  replyPreviewVideoContainer: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.muted,
    position: 'relative',
    overflow: 'hidden',
  },
  replyPreviewVideo: {
    width: '100%',
    height: '100%',
  },
  replyPreviewVideoPlayIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  replyPreviewVideoPlayIconText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  replyPreviewCompact: {
    marginBottom: 6,
  },
  replyPreviewWithMediaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyPreviewImageInline: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.muted,
  },
  replyPreviewVideoContainerInline: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.muted,
    position: 'relative',
    overflow: 'hidden',
  },
  replyPreviewVideoInline: {
    width: '100%',
    height: '100%',
  },
  replyPreviewVideoPlayIconInline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  replyPreviewVideoPlayIconTextInline: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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

  // Call UI styles - Telegram inspired
  incomingCallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f1419',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 1000,
  },
  incomingCallModal: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingBottom: 60,
    alignItems: 'center',
  },
  incomingCallAvatarContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  incomingCallAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.muted,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  incomingCallTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 24,
    textAlign: 'center',
  },
  incomingCallSubtitle: {
    fontSize: 20,
    color: '#8e8e93',
    marginBottom: 48,
    textAlign: 'center',
  },
  incomingCallButtons: {
    flexDirection: 'row',
    gap: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  activeCallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f1419',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  activeCallModal: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f1419',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  activeCallAvatarContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  activeCallAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.muted,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeCallTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  activeCallSubtitle: {
    fontSize: 20,
    color: '#8e8e93',
    marginBottom: 12,
    textAlign: 'center',
  },
  callDurationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  activeCallButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  callStatusText: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  connectingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  callHintText: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    marginTop: 4,
  },
  callActionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rejectCallButton: {
    backgroundColor: '#ff3b30',
  },
  acceptCallButton: {
    backgroundColor: '#34c759',
  },
  endCallButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 36,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callActionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  callActionButtonActive: {
    backgroundColor: '#48484a',
  },
  // Video call styles
  videoCallContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
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
    backgroundColor: '#0f1419',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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
    paddingVertical: 32,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  callControlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  callControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  callControlButtonActive: {
    backgroundColor: '#ff3b30',
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
    marginRight: 4,
  },

  // Call message styles
  callMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  callMessageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  callMessageIcon: {
    fontSize: 20,
  },
  callMessageText: {
    fontSize: 15,
    fontWeight: '600',
  },
  callMessageTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  dateDividerContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateDividerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
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
  // Upload wallpaper styles
  uploadWallpaperButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadWallpaperButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  uploadForm: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.muted,
    gap: 12,
  },
  uploadImageButton: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  uploadImagePreview: {
    width: '100%',
    height: '100%',
  },
  uploadImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadImagePlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  uploadInput: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  uploadSubmitButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSubmitButtonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
  uploadSubmitButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
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
    justifyContent: 'center',
    alignItems: 'center',
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
  attachButtonContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  attachMenu: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  attachMenuIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  attachMenuText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  pendingAttachmentContainer: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  pendingAttachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  pendingAttachmentVideo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingAttachmentVideoIcon: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 4,
  },
  pendingAttachmentVideoText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pendingAttachmentRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingAttachmentRemoveText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '700',
  },

  // Full-screen video viewer styles
  videoModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2001,
  },
  videoModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalPlayer: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    // resizeMode="contain" shows full video without cropping
    // maintains original aspect ratio and dimensions
  },

  // Full-screen image viewer styles
  imageModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2001,
  },
  imageModalCloseText: {
    fontSize: 24,
    color: 'white',
    fontWeight: '700',
  },
});
