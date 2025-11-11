import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, FlatList, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { userApi, endpoints } from '../api/client';
import { useAuthStore } from '../state/auth';

interface EventModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: EventData) => Promise<void>;
  loading?: boolean;
  event?: EventData | null;
  mode: 'create' | 'edit';
}

interface EventData {
  title: string;
  description: string;
  eventDate: Date;
  eventTime: Date | null;
  location: string;
  additionalNotes: string;
  inviteeIds: string[];
  eventType: string;
}

const EVENT_TYPES = [
  'Birthday',
  'Wedding',
  'Anniversary',
  'Holiday',
  'Graduation',
  'Baby Shower',
  'Housewarming',
  'General',
  'Other'
];

export const EventModal: React.FC<EventModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
  event = null,
  mode,
}) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = useMemo(() => createStyles(), [theme]);
  const { user } = useAuthStore();
  
  const [formData, setFormData] = useState<EventData>({
    title: event?.title || '',
    description: event?.description || '',
    eventDate: event?.eventDate || new Date(),
    eventTime: event?.eventTime || null,
    location: event?.location || '',
    additionalNotes: event?.additionalNotes || '',
    inviteeIds: event?.inviteeIds || [],
    eventType: event?.eventType || 'General',
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof EventData, string>>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set(event?.inviteeIds || []));
  
  // Date and time as strings for input
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  useEffect(() => {
    if (visible) {
      if (mode === 'create') {
        fetchFriends();
        // Initialize with current date for new events
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        setDateInput(todayStr);
        setTimeInput('');
        setFormData({
          title: '',
          description: '',
          eventDate: today,
          eventTime: null,
          location: '',
          additionalNotes: '',
          inviteeIds: [],
          eventType: 'General',
        });
        setSelectedFriends(new Set());
      } else if (mode === 'edit' && event) {
        fetchFriends();
        // Initialize with event data for editing
        const date = event.eventDate ? new Date(event.eventDate) : new Date();
        setDateInput(date.toISOString().split('T')[0]);
        
        let timeDate: Date | null = null;
        if (event.eventTime) {
          // eventTime might be a string in HH:mm:ss format or a Date
          if (typeof event.eventTime === 'string') {
            const timeParts = event.eventTime.split(':');
            if (timeParts.length >= 2) {
              timeDate = new Date();
              timeDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
              setTimeInput(`${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`);
            } else {
              setTimeInput('');
            }
          } else {
            timeDate = new Date(event.eventTime);
            setTimeInput(`${timeDate.getHours().toString().padStart(2, '0')}:${timeDate.getMinutes().toString().padStart(2, '0')}`);
          }
        } else {
          setTimeInput('');
        }
        
        setFormData({
          title: event.title || '',
          description: event.description || '',
          eventDate: date,
          eventTime: timeDate,
          location: event.location || '',
          additionalNotes: event.additionalNotes || '',
          inviteeIds: event.inviteeIds || [],
          eventType: event.eventType || 'General',
        });
        setSelectedFriends(new Set(event.inviteeIds || []));
      }
    }
  }, [visible, mode, event]);

  const fetchFriends = async () => {
    if (!user?.id) {
      setFriends([]);
      return;
    }
    
    try {
      setLoadingFriends(true);
      // Get user's following list (backend requires invitees to be in following list)
      const res = await userApi.get(endpoints.following(user.id, 1, 100));
      const followingList = res.data || [];
      // Ensure we have an array with id and username fields
      setFriends(Array.isArray(followingList) ? followingList.map((f: any) => ({
        id: f.id || f.userId,
        username: f.username || f.name || 'Unknown',
        name: f.name || f.username || 'Unknown',
        avatarUrl: f.avatarUrl || f.avatar,
      })) : []);
    } catch (error) {
      console.log('Error fetching friends:', error);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof EventData, string>> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.eventDate) {
      newErrors.eventDate = 'Event date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(formData.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      if (eventDate < today) {
        newErrors.eventDate = 'Event date cannot be in the past';
      }
    }
    
    if (formData.inviteeIds.length === 0) {
      newErrors.inviteeIds = 'At least one invitee is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      await onSubmit(formData);
      if (mode === 'create') {
        // Reset form only when creating
        setFormData({
          title: '',
          description: '',
          eventDate: new Date(),
          eventTime: null,
          location: '',
          additionalNotes: '',
          inviteeIds: [],
          eventType: 'General',
        });
        setSelectedFriends(new Set());
        setDateInput('');
        setTimeInput('');
      }
      setErrors({});
    } catch (error) {
      console.log('Error submitting event:', error);
    }
  };

  const handleClose = () => {
    if (mode === 'create') {
      // Reset form only when creating (not when editing)
      setFormData({
        title: '',
        description: '',
        eventDate: new Date(),
        eventTime: null,
        location: '',
        additionalNotes: '',
        inviteeIds: [],
        eventType: 'General',
      });
      setSelectedFriends(new Set());
      setDateInput('');
      setTimeInput('');
    }
    setErrors({});
    onClose();
  };

  const toggleFriendSelection = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
    setFormData(prev => ({
      ...prev,
      inviteeIds: Array.from(newSelected),
    }));
  };

  const handleDateChange = (text: string) => {
    setDateInput(text);
    // Parse date string (YYYY-MM-DD)
    const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
      const day = parseInt(dateMatch[3]);
      const newDate = new Date(year, month, day);
      if (!isNaN(newDate.getTime())) {
        setFormData(prev => ({ ...prev, eventDate: newDate }));
      }
    }
  };

  const handleTimeChange = (text: string) => {
    setTimeInput(text);
    // Parse time string (HH:mm)
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const timeDate = new Date();
        timeDate.setHours(hours, minutes, 0, 0);
        setFormData(prev => ({ ...prev, eventTime: timeDate }));
      }
    } else if (text === '') {
      setFormData(prev => ({ ...prev, eventTime: null }));
    }
  };

  const renderFriendItem = ({ item }: { item: any }) => {
    const isSelected = selectedFriends.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item.id)}
      >
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.username || item.name}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'create' ? t('event.createEvent', 'Create Event') : t('event.editEvent', 'Edit Event')}
          </Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.createButton} disabled={loading}>
            <Text style={[styles.createButtonText, loading && styles.createButtonDisabled]}>
              {loading ? t('common.saving', 'Saving...') : mode === 'create' ? t('common.create', 'Create') : t('common.save', 'Save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.titleLabel', 'Event Title *')}</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder={t('event.titlePlaceholder', 'Enter event title')}
              placeholderTextColor={colors.textMuted}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              autoCapitalize="words"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.descriptionLabel', 'Description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('event.descriptionPlaceholder', 'Enter event description (optional)')}
              placeholderTextColor={colors.textMuted}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Event Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.typeLabel', 'Event Type')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    formData.eventType === type && styles.typeChipSelected,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, eventType: type }))}
                >
                  <Text style={[
                    styles.typeChipText,
                    formData.eventType === type && styles.typeChipTextSelected,
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Date Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.dateLabel', 'Event Date *')}</Text>
            <TextInput
              style={[styles.input, errors.eventDate && styles.inputError]}
              placeholder="YYYY-MM-DD (e.g., 2024-12-25)"
              placeholderTextColor={colors.textMuted}
              value={dateInput}
              onChangeText={handleDateChange}
              keyboardType="numeric"
            />
            {errors.eventDate && <Text style={styles.errorText}>{errors.eventDate}</Text>}
            <Text style={styles.hintText}>Format: YYYY-MM-DD</Text>
          </View>

          {/* Time Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.timeLabel', 'Event Time (optional)')}</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:mm (e.g., 14:30)"
              placeholderTextColor={colors.textMuted}
              value={timeInput}
              onChangeText={handleTimeChange}
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>Format: HH:mm (24-hour format)</Text>
          </View>

          {/* Location Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.locationLabel', 'Location')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('event.locationPlaceholder', 'Enter event location (optional)')}
              placeholderTextColor={colors.textMuted}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
            />
          </View>

          {/* Additional Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('event.notesLabel', 'Additional Notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('event.notesPlaceholder', 'Enter additional notes (optional)')}
              placeholderTextColor={colors.textMuted}
              value={formData.additionalNotes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, additionalNotes: text }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Invitees Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('event.inviteesLabel', 'Invitees *')} ({selectedFriends.size} selected)
            </Text>
            {errors.inviteeIds && <Text style={styles.errorText}>{errors.inviteeIds}</Text>}
            {loadingFriends ? (
              <Text style={styles.loadingText}>{t('common.loading', 'Loading friends...')}</Text>
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>{t('event.noFriends', 'No friends to invite. Follow users to invite them to events.')}</Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                renderItem={renderFriendItem}
                style={styles.friendsList}
                nestedScrollEnabled={true}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  createButton: {
    padding: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  createButtonDisabled: {
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    height: 100,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    marginTop: 4,
  },
  typeScroll: {
    marginTop: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.muted,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  typeChipTextSelected: {
    color: 'white',
  },
  dateInput: {
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: colors.text,
  },
  hintText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  friendsList: {
    maxHeight: 200,
    marginTop: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  friendItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});

