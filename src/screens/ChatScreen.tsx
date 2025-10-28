import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { userApi, chatApi, endpoints } from '../api/client';
import { useAuthStore } from '../state/auth';
import { useSignalRChat } from '../hooks/useSignalRChat';

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
}

export const ChatScreen: React.FC<any> = ({ navigation }) => {
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
    return `conv_${user?.id}_${contactId}`;
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
  } = useSignalRChat({
    currentUserId: user?.id,
    token: token,
    onMessageReceived: (payload: any, username?: string) => {
      const nowIso = new Date().toISOString();
      // Server sends either: (userId, messageText) or ({ senderId, text }, username)
      const text = typeof payload === 'string' ? payload : (payload?.text ?? payload?.message ?? '');
      const sender = typeof payload === 'string' ? (username || 'other') : (payload?.senderId || username || 'other');
      const id = typeof payload === 'object' && payload?.id ? String(payload.id) : Date.now().toString();
      const replyToMessageId = typeof payload === 'object' && payload?.replyToMessageId ? String(payload.replyToMessageId) : null;
      
      // Use server timestamp if available, otherwise use current time
      const serverTimestamp = typeof payload === 'object' && payload?.sentAt 
        ? payload.sentAt 
        : typeof payload === 'object' && payload?.createdAt 
        ? payload.createdAt 
        : new Date().toISOString();
      
      // Extract custom data for voice messages
      const customData = typeof payload === 'object' ? payload?.customData : null;
      const messageType = customData?.messageType || 'text';
      const audioUrl = customData?.audioUrl;
      const audioDuration = customData?.audioDuration;

      const newMessage: ChatMessage = {
        id,
        text,
        userId: sender,
        username: username || 'Unknown',
        createdAt: serverTimestamp,
        replyToMessageId,
        messageType,
        ...(audioUrl && { audioUrl }),
        ...(audioDuration && { audioDuration })
      };

      // Determine which conversation this message belongs to
      // If it's from the current selected contact, add to current conversation
      if (selectedContact && sender === selectedContact.id) {
        if (currentConversationId) {
          addMessageToConversation(currentConversationId, newMessage);
        }
      } else if (sender !== user?.id) {
        // If it's from another contact, add to their conversation
        const senderConversationId = getConversationId(sender);
        addMessageToConversation(senderConversationId, newMessage);
        
        // Update the contact's last message in the sidebar
        const lastMessagePreview = messageType === 'voice' ? '🎤 Voice message' : text;
        setContacts(prev => prev.map(contact => 
          contact.id === sender 
            ? { ...contact, lastMessage: lastMessagePreview, lastMessageTime: nowIso }
            : contact
        ));
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

  useEffect(() => {
    fetchContacts();
  }, []);

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
      setContacts(contactsData);
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
      // Load chat history from API
      const response = await chatApi.get(endpoints.chatHistory(user.id, contactId, 1, 50));
      const messagesData: ChatMessage[] = response.data.map((msg: any) => ({
        id: msg.id,
        text: msg.text || msg.message || '',
        userId: msg.userId || msg.senderId,
        username: msg.username || msg.senderName || 'Unknown',
        createdAt: msg.createdAt || msg.sentAt || new Date().toISOString(),
        messageType: msg.messageType || 'text',
        audioUrl: msg.audioUrl,
        audioDuration: msg.audioDuration,
        imageUrl: msg.imageUrl,
        replyToMessageId: msg.replyToMessageId,
        reactions: msg.reactions || {},
      }));
      
      // Update conversation messages
      const conversationId = getConversationId(contactId);
      updateConversationMessages(conversationId, messagesData);
    } catch (error) {
      console.log('Error fetching messages:', error);
      // Fallback to empty array if API fails
      const conversationId = getConversationId(contactId);
      updateConversationMessages(conversationId, []);
    }
  };

  const handleContactSelect = async (contact: ChatContact) => {
    setSelectedContact(contact);
    setShowContacts(false);
    
    const conversationId = getConversationId(contact.id);
    setCurrentConversationId(conversationId);
    
    // Load messages for this conversation
    await fetchMessages(contact.id);
  };

  const handleSendMessage = async () => {
    try {
      if (!inputText.trim()) return;
      if (!user?.id) return;
      if (!connected) {
        setError('Connection lost. Please wait for reconnection...');
        return;
      }
      
      await sendText(inputText.trim());
      setInputText('');
    } catch (e: any) {
      console.error('Send message error:', e);
      setError(e?.message || 'Failed to send message');
    }
  };

  const sendText = async (text: string) => {
    if (!text.trim()) return;
    if (!user?.id) return;
    if (!connected) {
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
    };
    
    if (currentConversationId) {
      addMessageToConversation(currentConversationId, newMessage);
    }
    
    if (selectedContact) {
      const targetId = selectedContact.id;
      if (targetId && typeof targetId === 'string') {
        await sendToUserWithMeta(targetId, newMessage.text, undefined, id);
      } else {
        throw new Error('Invalid target user id');
      }
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
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (showContacts) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
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
              {selectedContact?.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreButtonText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
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

      {/* Connection Status */}
      {!connected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionText}>
            {connectionState === 'Reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </Text>
        </View>
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              if (text.trim()) {
                handleTyping();
              } else {
                handleStopTyping();
              }
            }}
            onBlur={handleStopTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [colors.gradientStart, colors.gradientMid, colors.gradientEnd] : [colors.muted, colors.muted]}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendButtonText}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
  },
  connectionText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500',
  },
});
