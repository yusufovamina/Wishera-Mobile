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
  read?: boolean;
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

  // Additional state for new features
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emojiMenuForId, setEmojiMenuForId] = useState<string | null>(null);
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);
  const REACTIONS = ["👍","❤️","😂","🎉","👏","😮","😢","🔥","✅","❌","👌","😁","🙏","🤔","😎","💖"];

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
    editMessage,
    deleteMessage,
    markMessagesRead,
    getConnectionId,
    addUser,
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

  // Subscribe to SignalR events for active users and reactions
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

    const offRead = onMessagesRead(({ byUserId, messageIds }) => {
      // Could update UI to show read ticks per message id
      console.log('Messages read:', messageIds);
    });

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
      offRead?.();
    };
  }, [connected, onReceiveActiveUsers, onMessageReactionUpdated, onMessagesRead, getConnectionId, addUser, user?.id]);

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
      replyToMessageId: replyTo?.id ?? null,
    };
    
    if (currentConversationId) {
      addMessageToConversation(currentConversationId, newMessage);
    }
    
    if (selectedContact) {
      const targetId = selectedContact.id;
      if (targetId && typeof targetId === 'string') {
        await sendToUserWithMeta(targetId, newMessage.text, replyTo?.id ?? undefined, id);
      } else {
        throw new Error('Invalid target user id');
      }
    }
  };

  // Handler for reacting to messages
  const handleReactToMessage = async (messageId: string, emoji: string) => {
    try {
      await reactToMessage(messageId, emoji);
    } catch (error) {
      console.error('Failed to react to message:', error);
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
              await deleteMessage(messageId);
              // Also try API endpoint as backup
              await chatApi.post(endpoints.deleteChatMessage, { messageId });
              
              // Remove from local state
              if (currentConversationId) {
                setConversations(prev => ({
                  ...prev,
                  [currentConversationId]: prev[currentConversationId]?.filter(m => m.id !== messageId) || []
                }));
              }
            } catch (error) {
              console.error('Failed to delete message:', error);
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
            <View style={styles.voiceMessageContainer}>
              <Text style={[styles.voiceMessageText, isOwnMessage && styles.ownVoiceMessageText]}>
                🎤 Voice message
              </Text>
              {item.audioDuration && (
                <Text style={[styles.voiceDuration, isOwnMessage && styles.ownVoiceDuration]}>
                  {Math.floor(item.audioDuration)}s
                </Text>
              )}
            </View>
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
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          
          {/* Action buttons (visible on long press or hover in future) */}
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setEmojiMenuForId(emojiMenuForId === item.id ? null : item.id)}
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
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleReactToMessage(item.id, emoji)}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
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

      {/* Reply Preview */}
      {replyTo && (
        <View style={styles.replyPreviewContainer}>
          <View style={styles.replyPreviewContent}>
            <View style={styles.replyPreviewLine} />
            <View style={styles.replyPreviewTextContainer}>
              <Text style={styles.replyPreviewLabel}>Replying to:</Text>
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
          <Text style={styles.editIndicatorText}>Editing message...</Text>
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

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.messageInput}
            placeholder={editingId ? "Edit message..." : "Type a message..."}
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
            style={[styles.sendButton, (!inputText.trim() && !editingId) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() && !editingId}
          >
            <LinearGradient
              colors={(inputText.trim() || editingId) ? [colors.gradientStart, colors.gradientMid, colors.gradientEnd] : [colors.muted, colors.muted]}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendButtonText}>{editingId ? "✓" : "→"}</Text>
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
  },
  actionButton: {
    padding: 4,
  },
  actionButtonText: {
    fontSize: 14,
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
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emojiButtonText: {
    fontSize: 18,
  },
});
