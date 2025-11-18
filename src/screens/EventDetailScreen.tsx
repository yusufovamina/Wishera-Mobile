import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, StatusBar, RefreshControl, Image } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { useAuthStore } from '../state/auth';
import { endpoints, getApiClient } from '../api/client';
import { EventModal } from '../components/EventModal';
import { CalendarIcon, TimeIcon, LocationIcon, DocumentTextIcon, CheckIcon, CloseIcon, EditIcon, DeleteIcon, BanIcon } from '../components/Icon';

type EventDetail = {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  additionalNotes?: string;
  eventType?: string;
  isCancelled?: boolean;
  createdBy?: string;
  createdByUsername?: string;
  invitations?: Array<{
    id: string;
    userId: string;
    username: string;
    status: 'pending' | 'accepted' | 'declined';
    avatarUrl?: string;
  }>;
};

export const EventDetailScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const styles = useMemo(() => createStyles(), [theme]);
  const { user } = useAuthStore();
  const eventId = route?.params?.eventId || route?.params?.id;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  // Refresh when screen comes into focus (e.g., after editing from another screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (eventId) {
        fetchEvent();
      }
    });
    return unsubscribe;
  }, [navigation, eventId]);

  const fetchEvent = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      const eventApi = getApiClient(endpoints.eventById(eventId));
      console.log('Fetching event from:', eventApi.defaults.baseURL + endpoints.eventById(eventId));
      const res = await eventApi.get(endpoints.eventById(eventId));
      console.log('Event response:', res.data);
      
      // Transform backend response to match our EventDetail type
      const eventData = res.data;
      
      // Extract invitations with better status handling
      let invitations: any[] = [];
      
      // Try different possible invitation fields
      if (Array.isArray(eventData.invitations)) {
        invitations = eventData.invitations;
      } else if (Array.isArray(eventData.invitees)) {
        invitations = eventData.invitees;
      } else if (Array.isArray(eventData.invitationList)) {
        invitations = eventData.invitationList;
      } else if (Array.isArray(eventData.invitationsList)) {
        invitations = eventData.invitationsList;
      }
      
      console.log('Raw invitations data:', invitations);
      console.log('Invitation count:', invitations.length);
      console.log('Full event data keys:', Object.keys(eventData));
      console.log('Event data structure:', JSON.stringify(eventData, null, 2));
      
      // If no invitations in the event response, try fetching them separately
      if (invitations.length === 0) {
        console.log('No invitations in event response, trying to fetch separately...');
        try {
          const invitationsApi = getApiClient(endpoints.eventInvitations(eventId));
          const invitationsRes = await invitationsApi.get(endpoints.eventInvitations(eventId));
          console.log('Separate invitations response:', invitationsRes.data);
          
          if (Array.isArray(invitationsRes.data)) {
            invitations = invitationsRes.data;
          } else if (Array.isArray(invitationsRes.data?.items)) {
            invitations = invitationsRes.data.items;
          } else if (Array.isArray(invitationsRes.data?.invitations)) {
            invitations = invitationsRes.data.invitations;
          }
          console.log('Fetched invitations separately, count:', invitations.length);
        } catch (invError: any) {
          console.log('Could not fetch invitations separately:', invError?.response?.status, invError?.response?.data);
          // Continue with empty invitations if separate fetch fails
        }
      }
      
      // Transform invitations with proper status extraction
      const transformedInvitations = await Promise.all(invitations.map(async (inv: any) => {
        // Try multiple possible status field names and normalize to lowercase
        let status = 'pending';
        if (inv.status) {
          status = String(inv.status).toLowerCase();
        } else if (inv.invitationStatus) {
          status = String(inv.invitationStatus).toLowerCase();
        } else if (inv.responseStatus) {
          status = String(inv.responseStatus).toLowerCase();
        } else if (inv.response) {
          status = String(inv.response).toLowerCase();
        }
        
        // Normalize status values
        if (status === 'accept' || status === 'accepted') {
          status = 'accepted';
        } else if (status === 'decline' || status === 'declined' || status === 'rejected') {
          status = 'declined';
        } else {
          status = 'pending';
        }
        
        console.log('Invitation:', {
          id: inv.id || inv.invitationId,
          username: inv.username || inv.inviteeUsername || inv.name,
          status: status,
          rawStatus: inv.status || inv.invitationStatus || inv.responseStatus,
        });
        
        // Extract invitee (person being invited) information, NOT the inviter
        // The invitee is the person who received the invitation
        // First, get the invitee's userId - this is the person who was invited
        const eventCreatorId = eventData.createdBy || eventData.creatorId || eventData.userId || '';
        
        // Get potential invitee ID from various fields
        let inviteeUserId = inv.inviteeId || inv.inviteeUserId || inv.invitee?.id || inv.invitee?.userId || '';
        
        // If no invitee-specific ID, try userId but make sure it's not the creator
        if (!inviteeUserId) {
          const potentialUserId = inv.userId || inv.user?.id || '';
          if (potentialUserId && potentialUserId !== eventCreatorId) {
            inviteeUserId = potentialUserId;
          }
        }
        
        // Final check: make sure we're not using the creator's ID as the invitee
        const actualInviteeId = inviteeUserId && inviteeUserId !== eventCreatorId ? inviteeUserId : '';
        
        let username = 'Unknown';
        let avatarUrl = '';
        
        // Priority: Check invitee-specific fields first (person being invited)
        if (inv.invitee?.username) {
          username = inv.invitee.username;
          avatarUrl = inv.invitee.avatarUrl || inv.invitee.avatar || '';
        } else if (inv.invitee?.name) {
          username = inv.invitee.name;
          avatarUrl = inv.invitee.avatarUrl || inv.invitee.avatar || '';
        } else if (inv.inviteeUsername) {
          username = inv.inviteeUsername;
          avatarUrl = inv.inviteeAvatarUrl || inv.inviteeAvatar || '';
        } else if (inv.inviteeName) {
          username = inv.inviteeName;
          avatarUrl = inv.inviteeAvatarUrl || inv.inviteeAvatar || '';
        } else if (inv.user?.id && inv.user.id === actualInviteeId && inv.user.id !== eventCreatorId) {
          // Only use if this user object is the invitee (not the creator)
          username = inv.user.username || inv.user.name || 'Unknown';
          avatarUrl = inv.user.avatarUrl || inv.user.avatar || '';
        } else if (inv.username && inv.userId === actualInviteeId && inv.userId !== eventCreatorId) {
          // Only use if this is the invitee's username (not the creator)
          username = inv.username;
          avatarUrl = inv.avatarUrl || inv.avatar || '';
        } else if (actualInviteeId && actualInviteeId !== eventCreatorId) {
          // If we have invitee userId but no username, fetch user info
          try {
            const userApi = getApiClient(endpoints.identification);
            const userRes = await userApi.get(`${endpoints.identification}?userId=${actualInviteeId}`);
            if (userRes.data?.username) {
              username = userRes.data.username;
            } else if (userRes.data?.name) {
              username = userRes.data.name;
            }
            if (userRes.data?.avatarUrl) {
              avatarUrl = userRes.data.avatarUrl;
            }
            console.log('Fetched invitee info for userId:', actualInviteeId, 'username:', username);
          } catch (userError: any) {
            console.log('Could not fetch invitee info for userId:', actualInviteeId, userError?.response?.status);
          }
        }
        
        console.log('Extracted invitee username:', username, 'from invitation:', {
          inviteeUserId: actualInviteeId,
          eventCreatorId: eventCreatorId,
          isCreator: actualInviteeId === eventCreatorId,
          hasInvitee: !!inv.invitee,
          hasInviteeUsername: !!inv.inviteeUsername,
          hasInviteeName: !!inv.inviteeName,
          hasUser: !!inv.user,
          userIsInvitee: inv.user?.id === actualInviteeId && inv.user?.id !== eventCreatorId,
          fullInvitation: JSON.stringify(inv, null, 2),
        });
        
        return {
          id: inv.id || inv.invitationId || '',
          userId: actualInviteeId,
          username: username,
          status: status as 'pending' | 'accepted' | 'declined',
          avatarUrl: avatarUrl,
        };
      }));
      
      console.log('Transformed invitations:', transformedInvitations);
      
      const transformedEvent: EventDetail = {
        id: eventData.id || eventId,
        title: eventData.title || '',
        description: eventData.description,
        eventDate: eventData.eventDate || eventData.date || '',
        eventTime: eventData.eventTime || eventData.time,
        location: eventData.location,
        additionalNotes: eventData.additionalNotes || eventData.notes,
        eventType: eventData.eventType || eventData.type,
        isCancelled: eventData.isCancelled || eventData.cancelled || false,
        createdBy: eventData.createdBy || eventData.creatorId || eventData.userId,
        createdByUsername: eventData.createdByUsername || eventData.creatorUsername,
        invitations: transformedInvitations.length > 0 ? transformedInvitations : [],
      };
      
      console.log('Final event data:', {
        id: transformedEvent.id,
        title: transformedEvent.title,
        invitationsCount: transformedEvent.invitations?.length || 0,
        invitations: transformedEvent.invitations,
      });
      
      setEvent(transformedEvent);
    } catch (error: any) {
      console.log('Error fetching event:', error);
      console.log('Error response:', error?.response?.data);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvent();
    setRefreshing(false);
  };

  const handleEdit = async (data: any) => {
    if (!eventId) return;
    
    try {
      setEditLoading(true);
      const eventApi = getApiClient(endpoints.eventById(eventId));
      
      // Convert event data to API format
      const eventDate = new Date(data.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      
      let eventTime: string | null = null;
      if (data.eventTime) {
        const timeDate = new Date(data.eventTime);
        const hours = timeDate.getHours();
        const minutes = timeDate.getMinutes();
        eventTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      }
      
      const eventData = {
        title: data.title,
        description: data.description || '',
        eventDate: eventDate.toISOString().split('T')[0],
        eventTime: eventTime,
        location: data.location || '',
        additionalNotes: data.additionalNotes || '',
        inviteeIds: data.inviteeIds || [],
        eventType: data.eventType || 'General',
      };
      
      await eventApi.put(endpoints.updateEvent(eventId), eventData);
      setShowEditModal(false);
      await fetchEvent(); // Refresh event data
      Alert.alert('Success', 'Event updated successfully!');
    } catch (error: any) {
      console.log('Error updating event:', error);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to update event';
      Alert.alert('Error', errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteLoading(true);
              console.log('Deleting event:', eventId);
              console.log('Delete endpoint:', endpoints.deleteEvent(eventId));
              
              const eventApi = getApiClient(endpoints.deleteEvent(eventId));
              console.log('Using API client:', eventApi.defaults.baseURL);
              
              const response = await eventApi.delete(endpoints.deleteEvent(eventId));
              console.log('Delete response:', response.data);
              console.log('Event deleted successfully');
              
              Alert.alert('Success', 'Event deleted successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error: any) {
              console.error('Error deleting event:', error);
              console.error('Error response:', error?.response?.data);
              console.error('Error status:', error?.response?.status);
              console.error('Error config:', error?.config?.url);
              
              const errorMessage = error?.response?.data?.message || 
                                 error?.response?.data?.error || 
                                 error?.message || 
                                 'Failed to delete event';
              Alert.alert('Error', errorMessage);
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              setDeleteLoading(true);
              console.log('Cancelling event:', eventId);
              console.log('Cancel endpoint:', endpoints.cancelEvent(eventId));
              
              const eventApi = getApiClient(endpoints.cancelEvent(eventId));
              console.log('Using API client:', eventApi.defaults.baseURL);
              
              // Try POST first, if that fails try PUT
              try {
                const response = await eventApi.post(endpoints.cancelEvent(eventId), {});
                console.log('Cancel response (POST):', response.data);
              } catch (postError: any) {
                console.log('POST failed, trying PUT:', postError?.response?.status);
                const response = await eventApi.put(endpoints.cancelEvent(eventId), { isCancelled: true });
                console.log('Cancel response (PUT):', response.data);
              }
              
              console.log('Event cancelled successfully');
              await fetchEvent(); // Refresh event data
              Alert.alert('Success', 'Event cancelled successfully!');
            } catch (error: any) {
              console.error('Error cancelling event:', error);
              console.error('Error response:', error?.response?.data);
              console.error('Error status:', error?.response?.status);
              console.error('Error config:', error?.config?.url);
              
              const errorMessage = error?.response?.data?.message || 
                                 error?.response?.data?.error || 
                                 error?.message || 
                                 'Failed to cancel event';
              Alert.alert('Error', errorMessage);
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }
    return timeString;
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'accepted':
        return colors.success;
      case 'declined':
        return colors.danger;
      case 'pending':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const isOwner = event?.createdBy === user?.id;

  if (loading && !event) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Event not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            tintColor={colors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{event.title}</Text>
            {event.isCancelled && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledText}>Cancelled</Text>
              </View>
            )}
          </View>
          
          {event.eventType && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{event.eventType}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {/* Event Details */}
        <View style={styles.section}>
          <View style={styles.detailRow}>
            <CalendarIcon size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(event.eventDate)}</Text>
            </View>
          </View>

          {event.eventTime && (
            <View style={styles.detailRow}>
              <TimeIcon size={20} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formatTime(event.eventTime)}</Text>
              </View>
            </View>
          )}

          {event.location && (
            <View style={styles.detailRow}>
              <LocationIcon size={20} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{event.location}</Text>
              </View>
            </View>
          )}

          {event.additionalNotes && (
            <View style={styles.detailRow}>
              <DocumentTextIcon size={20} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Additional Notes</Text>
                <Text style={styles.detailValue}>{event.additionalNotes}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Invitations Section - Always show if event exists */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Invitations {event.invitations && event.invitations.length > 0 ? `(${event.invitations.length})` : '(0)'}
          </Text>
          {event.invitations && event.invitations.length > 0 ? (
            event.invitations.map((invitation) => {
              // Ensure status is always defined and normalized
              const normalizedStatus = (invitation.status || 'pending').toLowerCase();
              const finalStatus = normalizedStatus === 'accepted' ? 'accepted' : 
                                 normalizedStatus === 'declined' ? 'declined' : 'pending';
              
              const statusColor = getInvitationStatusColor(finalStatus);
              const StatusIconComponent = finalStatus === 'accepted' ? CheckIcon : 
                                         finalStatus === 'declined' ? CloseIcon : TimeIcon;
              const statusText = finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1);
              
              return (
                <View key={invitation.id} style={styles.invitationItem}>
                  <View style={styles.invitationInfo}>
                    {invitation.avatarUrl ? (
                      <Image 
                        source={{ uri: invitation.avatarUrl }} 
                        style={styles.invitationAvatar}
                      />
                    ) : (
                      <View style={styles.invitationAvatarPlaceholder}>
                        <Text style={styles.invitationAvatarText}>
                          {invitation.username?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.invitationDetails}>
                      <Text style={styles.invitationUsername}>@{invitation.username}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <StatusIconComponent size={14} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {statusText}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyInvitations}>
              <Text style={styles.emptyInvitationsText}>No invitations yet</Text>
            </View>
          )}
        </View>

        {/* Action Buttons - Only show for owner */}
        {isOwner && !event.isCancelled && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setShowEditModal(true)}
              disabled={editLoading || deleteLoading}
            >
              <EditIcon size={18} color="white" />
              <Text style={styles.actionButtonText}>Edit Event</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={editLoading || deleteLoading}
            >
              <BanIcon size={18} color="white" />
              <Text style={styles.actionButtonText}>Cancel Event</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={editLoading || deleteLoading}
            >
              <DeleteIcon size={18} color="white" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete Event</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit Event Modal */}
      <EventModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEdit}
        loading={editLoading}
        event={event ? {
          title: event.title,
          description: event.description || '',
          eventDate: new Date(event.eventDate),
          eventTime: event.eventTime ? (() => {
            const parts = event.eventTime.split(':');
            if (parts.length >= 2) {
              const timeDate = new Date();
              timeDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
              return timeDate;
            }
            return null;
          })() : null,
          location: event.location || '',
          additionalNotes: event.additionalNotes || '',
          inviteeIds: event.invitations?.map(inv => inv.userId) || [],
          eventType: event.eventType || 'General',
        } : null}
        mode="edit"
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSection: {
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  cancelledBadge: {
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cancelledText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  invitationItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invitationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invitationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
  },
  invitationAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  invitationDetails: {
    flex: 1,
    gap: 6,
  },
  invitationUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyInvitations: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyInvitationsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  actionsSection: {
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    backgroundColor: colors.warning,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  deleteButtonText: {
    color: 'white',
  },
});

