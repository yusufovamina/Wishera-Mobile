import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, StatusBar, RefreshControl, Image, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n';
import { usePreferences } from '../state/preferences';
import { useAuthStore } from '../state/auth';
import { endpoints, getApiClient, userApi } from '../api/client';
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
      
      // ALWAYS fetch invitations separately to ensure we get all invitees
      // The backend has a dedicated endpoint for event invitations that returns InviteeId
      let invitations: any[] = [];
      
      try {
        console.log('Fetching event invitations from separate endpoint...');
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
        console.log('✅ Fetched invitations separately, count:', invitations.length);
        // Log each invitation's InviteeId and InviterId to debug
        invitations.forEach((inv: any, index: number) => {
          console.log(`📋 Invitation ${index + 1}:`, {
            id: inv.id || inv.invitationId,
            InviteeId: inv.InviteeId || inv.inviteeId,
            InviterId: inv.InviterId || inv.inviterId,
            InviterUsername: inv.InviterUsername || inv.inviterUsername,
            Status: inv.status || inv.invitationStatus,
          });
        });
       } catch (invError: any) {
         console.warn('⚠️ Could not fetch invitations separately, trying event response:', invError?.response?.status, invError?.response?.data);
        
        // Fallback: try to get invitations from event response if separate fetch fails
        if (Array.isArray(eventData.invitations)) {
          invitations = eventData.invitations;
        } else if (Array.isArray(eventData.invitees)) {
          invitations = eventData.invitees;
        } else if (Array.isArray(eventData.invitationList)) {
          invitations = eventData.invitationList;
        } else if (Array.isArray(eventData.invitationsList)) {
          invitations = eventData.invitationsList;
        }
        console.log('Fallback: Found invitations in event response, count:', invitations.length);
      }
      
      // Transform invitations with proper status extraction
      console.log(`🔄 Starting to transform ${invitations.length} invitations...`);
      const transformedInvitations = await Promise.all(invitations.map(async (inv: any, index: number) => {
        console.log(`\n📄 Processing invitation ${index + 1}/${invitations.length}:`, {
          invitationId: inv.id || inv.invitationId,
          rawInviteeId: inv.InviteeId || inv.inviteeId,
          rawInviterId: inv.InviterId || inv.inviterId,
          rawInviterUsername: inv.InviterUsername || inv.inviterUsername,
        });
        
        // Log the full raw invitation for debugging
        console.log('Raw invitation object:', JSON.stringify(inv, null, 2));
        
        // Try multiple possible status field names and normalize to lowercase
        let status = 'pending';
        if (inv.status !== undefined) {
          status = String(inv.status).toLowerCase();
        } else if (inv.invitationStatus !== undefined) {
          status = String(inv.invitationStatus).toLowerCase();
        } else if (inv.responseStatus !== undefined) {
          status = String(inv.responseStatus).toLowerCase();
        } else if (inv.response !== undefined) {
          status = String(inv.response).toLowerCase();
        }
        
        // Normalize status values
        if (status === 'accept' || status === 'accepted' || status === '1') {
          status = 'accepted';
        } else if (status === 'decline' || status === 'declined' || status === 'rejected' || status === '2') {
          status = 'declined';
        } else {
          status = 'pending';
        }
        
        console.log('Invitation status extracted:', {
          id: inv.id || inv.invitationId,
          rawStatus: inv.status,
          normalizedStatus: status,
        });
        
        // Extract invitee (person being invited) information, NOT the inviter
        // The backend returns:
        // - InviteeId: the ID of the person who was invited
        // - InviterUsername/InviterAvatarUrl: the inviter's (event creator's) info
        // - Possibly username/avatarUrl fields that might be inviter data
        // We MUST only use InviteeId to fetch invitee info, and ignore all inviter fields
        
        const eventCreatorId = eventData.createdBy || eventData.creatorId || eventData.userId || '';
        
        // Get invitee ID from backend response (this is the person who was invited)
        // Backend returns this as "InviteeId" (capital I) or "inviteeId" (camelCase)
        const inviteeId = inv.InviteeId || inv.inviteeId || inv.inviteeUserId || 
                         inv.invitee?.id || inv.invitee?.userId || '';
        
        // Get inviter ID to make sure we're not mixing them up
        const inviterId = inv.InviterId || inv.inviterId || eventCreatorId || '';
        
        console.log(`🔍 Extracted IDs for invitation ${index + 1}:`, {
          inviteeId: inviteeId,
          inviterId: inviterId,
          eventCreatorId: eventCreatorId,
          inviteeIdMatchesCreator: inviteeId === eventCreatorId,
        });
        
        // Make sure we have an invitee ID and it's not the creator
        const actualInviteeId = inviteeId && inviteeId !== eventCreatorId ? inviteeId : '';
        
        if (!actualInviteeId) {
          console.error(`❌ PROBLEM: No valid InviteeId for invitation ${index + 1}!`, {
            inviteeId: inviteeId,
            eventCreatorId: eventCreatorId,
            isCreator: inviteeId === eventCreatorId,
          });
        }
        
        // IMPORTANT: Do NOT use any of these fields as they might be inviter data:
        // - inv.username (could be InviterUsername)
        // - inv.avatarUrl (could be InviterAvatarUrl)
        // - inv.InviterUsername (definitely inviter)
        // - inv.InviterAvatarUrl (definitely inviter)
        // - inv.name (could be inviter name)
        
        let username = 'Unknown';
        let avatarUrl = '';
        
        // Only check for explicitly invitee-specific fields (which backend likely doesn't provide)
        if (inv.invitee?.username) {
          username = inv.invitee.username;
          avatarUrl = inv.invitee.avatarUrl || inv.invitee.avatar || '';
        } else if (inv.inviteeUsername) {
          username = inv.inviteeUsername;
          avatarUrl = inv.inviteeAvatarUrl || inv.inviteeAvatar || '';
        }
        
        // ALWAYS fetch invitee info using InviteeId - this is the only reliable way
        // The backend provides InviteeId, so we use it to get the invitee's user info
        // Use /api/users/{userId} endpoint (like ChatScreen and ProfileScreen do), NOT /api/users/profile
        if (actualInviteeId) {
          try {
            const userApi = getApiClient(`/api/users/${actualInviteeId}`);
            const userRes = await userApi.get(`/api/users/${actualInviteeId}`);
            console.log(`👤 User API response for InviteeId ${actualInviteeId}:`, {
              username: userRes.data?.username,
              name: userRes.data?.name,
              avatarUrl: userRes.data?.avatarUrl ? 'present' : 'none',
            });
            if (userRes.data?.username) {
              username = userRes.data.username;
            } else if (userRes.data?.name) {
              username = userRes.data.name;
            }
            if (userRes.data?.avatarUrl) {
              avatarUrl = userRes.data.avatarUrl;
            }
            console.log(`✅ Fetched INVITEE info for invitation ${index + 1} - InviteeId: ${actualInviteeId}, username: ${username}, avatarUrl: ${avatarUrl ? 'present' : 'none'}`);
          } catch (userError: any) {
            console.error(`❌ Could not fetch invitee info for InviteeId: ${actualInviteeId}`, {
              status: userError?.response?.status,
              data: userError?.response?.data,
              message: userError?.message,
            });
            // If fetch fails and we still don't have a username, keep it as Unknown
          }
        } else {
          console.warn('⚠️ No valid InviteeId found in invitation:', inv);
        }
        
        // IMPORTANT: We fetched using InviteeId, so username and avatarUrl are definitely the invitee's info
        // We don't compare with inviter values because usernames/avatars can legitimately be the same
        // The key is that we used InviteeId to fetch, not InviterUsername/InviterAvatarUrl
        
        console.log(`✅ Final extracted INVITEE data for invitation ${index + 1}:`, {
          invitationId: inv.id || inv.invitationId,
          inviteeId: actualInviteeId,
          inviteeUsername: username,
          inviteeAvatarUrl: avatarUrl ? 'present' : 'none',
          inviterId: inviterId,
          inviterUsername: inv.InviterUsername || inv.inviterUsername || 'N/A',
          fetchedUsingInviteeId: !!actualInviteeId,
        });
        
        const invitationResult = {
          id: inv.id || inv.invitationId || '',
          userId: actualInviteeId,
          username: username,
          status: status as 'pending' | 'accepted' | 'declined',
          avatarUrl: avatarUrl,
        };
        
        console.log(`✅ Final invitation result ${index + 1}:`, {
          id: invitationResult.id,
          inviteeUserId: invitationResult.userId,
          inviteeUsername: invitationResult.username,
          inviteeAvatarUrl: invitationResult.avatarUrl ? 'present' : 'none',
          status: invitationResult.status,
        });
        
        return invitationResult;
      }));
      
      console.log('\n📊 All transformed invitations summary:');
      transformedInvitations.forEach((inv, index) => {
        console.log(`  Invitation ${index + 1}:`, {
          id: inv.id,
          userId: inv.userId,
          username: inv.username,
          status: inv.status,
        });
      });
      console.log('Transformed invitations array:', transformedInvitations);
      
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

  const performDeleteAction = async () => {
    console.log('performDeleteAction called, making API call...');
    console.log('Delete endpoint:', endpoints.deleteEvent(eventId));
    console.log('UserApi baseURL:', userApi.defaults.baseURL);
    console.log('Full URL:', userApi.defaults.baseURL + endpoints.deleteEvent(eventId));
    
    try {
      setDeleteLoading(true);
      
      // Use userApi directly like web version uses axios directly
      const response = await userApi.delete(endpoints.deleteEvent(eventId));
      
      console.log('Delete API call successful, status:', response.status);
      console.log('Delete response:', response.data);
      
      if (Platform.OS === 'web') {
        window.alert('Event deleted successfully!');
        navigation.goBack();
      } else {
        Alert.alert('Success', 'Event deleted successfully!', [
          { 
            text: 'OK', 
            onPress: () => {
              console.log('Navigating back after delete');
              navigation.goBack();
            }
          }
        ]);
      }
    } catch (error: any) {
      console.error('Delete API call failed:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      console.error('Error message:', error?.message);
      
      const errorMessage = error?.response?.data?.message || 
                         error?.response?.data?.error || 
                         error?.message || 
                         'Failed to delete event';
      console.error('Showing error alert:', errorMessage);
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      console.log('Setting deleteLoading to false');
      setDeleteLoading(false);
    }
  };

  const handleDelete = () => {
    console.log('handleDelete called, eventId:', eventId);
    
    if (!eventId) {
      console.error('Event ID is missing');
      if (Platform.OS === 'web') {
        window.alert('Error: Event ID is missing');
      } else {
        Alert.alert('Error', 'Event ID is missing');
      }
      return;
    }
    
    // Use window.confirm on web (like web version), Alert.alert on native
    if (Platform.OS === 'web') {
      console.log('Using window.confirm for web platform');
      if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        performDeleteAction();
      } else {
        console.log('Delete cancelled by user');
      }
    } else {
      console.log('Showing delete confirmation Alert for native platform...');
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event? This action cannot be undone.',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              console.log('Delete cancelled by user');
            }
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDeleteAction,
          },
        ]
      );
      console.log('Alert.alert called');
    }
  };

  const performCancelAction = async () => {
    try {
      setDeleteLoading(true);
      
      // Use userApi directly like web version uses axios directly
      await userApi.put(endpoints.cancelEvent(eventId), null);
      
      await fetchEvent(); // Refresh event data
      
      if (Platform.OS === 'web') {
        window.alert('Event cancelled successfully!');
      } else {
        Alert.alert('Success', 'Event cancelled successfully!');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 
                         error?.response?.data?.error || 
                         error?.message || 
                         'Failed to cancel event';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancel = () => {
    if (!eventId) {
      if (Platform.OS === 'web') {
        window.alert('Error: Event ID is missing');
      } else {
        Alert.alert('Error', 'Event ID is missing');
      }
      return;
    }
    
    // Use window.confirm on web (like web version), Alert.alert on native
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to cancel this event?')) {
        performCancelAction();
      }
    } else {
      Alert.alert(
        'Cancel Event',
        'Are you sure you want to cancel this event?',
        [
          { 
            text: 'No', 
            style: 'cancel'
          },
          {
            text: 'Yes',
            onPress: performCancelAction,
          },
        ]
      );
    }
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
            {`Invitations ${event.invitations && event.invitations.length > 0 ? `(${event.invitations.length})` : '(0)'}`}
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
                          {(invitation.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.invitationDetails}>
                      <Text style={styles.invitationUsername}>
                        @{invitation.username || invitation.userId || 'Unknown'}
                      </Text>
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
              style={[styles.actionButton, styles.deleteButton, (editLoading || deleteLoading) && styles.disabledButton]}
              onPress={() => {
                console.log('Delete button pressed!');
                if (editLoading || deleteLoading) {
                  console.log('Button is disabled, ignoring press');
                  return;
                }
                handleDelete();
              }}
              disabled={editLoading || deleteLoading}
            >
              <DeleteIcon size={18} color="white" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                {deleteLoading ? 'Deleting...' : 'Delete Event'}
              </Text>
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

