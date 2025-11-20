import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Image } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { endpoints, getApiClient } from '../api/client';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';
import { CalendarIcon, TimeIcon, LocationIcon, CheckIcon, CloseIcon } from '../components/Icon';

type InvitationItem = { 
  id: string; 
  invitationId?: string;
  eventId?: string;
  eventTitle: string; 
  eventDate?: string;
  eventTime?: string;
  location?: string;
  createdBy?: string;
  createdByUsername?: string;
  createdByAvatarUrl?: string;
  status?: 'pending' | 'accepted' | 'declined';
};

export const InvitationsScreen: React.FC<any> = ({ navigation }) => {
  const { theme } = usePreferences();
  const { t } = useI18n();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InvitationItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const eventApi = getApiClient(endpoints.myInvitations(1, 50));
      const res = await eventApi.get(endpoints.myInvitations(1, 50));
      console.log('Invitations response:', res.data);
      
      // Transform backend response
      const backendItems = res.data?.items || res.data?.invitations || res.data || [];
      const transformedItems: InvitationItem[] = backendItems.map((item: any) => ({
        id: item.id || item.invitationId || '',
        invitationId: item.invitationId || item.id,
        eventId: item.eventId || item.event?.id,
        eventTitle: item.eventTitle || item.event?.title || item.title || 'Event',
        eventDate: item.eventDate || item.event?.eventDate || item.event?.date,
        eventTime: item.eventTime || item.event?.eventTime || item.event?.time,
        location: item.location || item.event?.location,
        createdBy: item.createdBy || item.event?.createdBy || item.event?.creatorId || item.inviterId,
        createdByUsername: item.createdByUsername || item.event?.createdByUsername || item.event?.creatorUsername || item.inviterUsername,
        createdByAvatarUrl: item.createdByAvatarUrl || item.event?.createdByAvatarUrl || item.event?.creatorAvatarUrl || item.inviterAvatarUrl,
        status: item.status || item.invitationStatus || 'pending',
      }));
      
      setItems(transformedItems);
    } catch (e: any) {
      console.error('Failed to load invitations:', e);
      console.error('Error response:', e?.response?.data);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const respond = async (invitationId: string, accept: boolean) => {
    try {
      console.log('Responding to invitation:', invitationId, accept ? 'accepted' : 'declined');
      const eventApi = getApiClient(endpoints.respondInvitation(invitationId));
      await eventApi.post(endpoints.respondInvitation(invitationId), { 
        status: accept ? 'accepted' : 'declined' 
      });
      console.log('Invitation response sent successfully');
      Alert.alert(
        t('invitations.success', 'Success'), 
        accept ? t('invitations.accepted', 'Invitation accepted!') : t('invitations.declined', 'Invitation declined')
      );
      await load();
    } catch (e: any) {
      console.error('Respond failed:', e);
      console.error('Error response:', e?.response?.data);
      Alert.alert(
        t('invitations.error', 'Error'), 
        e?.response?.data?.message || t('invitations.responseFailed', 'Failed to respond to invitation')
      );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
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

  const getStatusColor = (status?: string) => {
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

  useEffect(() => { load(); }, []);

  // Refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation]);

  const renderInvitation = ({ item }: { item: InvitationItem }) => {
    const invitationId = item.invitationId || item.id;
    const canRespond = item.status === 'pending' || !item.status;
    
    return (
      <View style={styles.card}>
        <TouchableOpacity 
          onPress={() => {
            if (item.eventId) {
              navigation.navigate('EventDetail', { eventId: item.eventId });
            }
          }}
          disabled={!item.eventId}
        >
          {/* User Avatar and Username */}
          {item.createdByUsername && (
            <View style={styles.userInfo}>
              {item.createdByAvatarUrl ? (
                <Image 
                  source={{ uri: item.createdByAvatarUrl }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {item.createdByUsername.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.username}>@{item.createdByUsername}</Text>
            </View>
          )}
          
          <Text style={styles.title}>{item.eventTitle}</Text>
          
          {(item.eventDate || item.eventTime) && (
            <View style={styles.details}>
              {item.eventDate && (
                <View style={styles.detailRow}>
                  <CalendarIcon size={14} color={themeColors.textSecondary} />
                  <Text style={styles.detailText}>{formatDate(item.eventDate)}</Text>
                </View>
              )}
              {item.eventTime && (
                <View style={styles.detailRow}>
                  <TimeIcon size={14} color={themeColors.textSecondary} />
                  <Text style={styles.detailText}>{formatTime(item.eventTime)}</Text>
                </View>
              )}
              {item.location && (
                <View style={styles.detailRow}>
                  <LocationIcon size={14} color={themeColors.textSecondary} />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Status Badge - show for all statuses including pending */}
          {item.status && (
            <View style={[
              styles.statusBadge, 
              { 
                backgroundColor: getStatusColor(item.status) + '20',
                borderColor: getStatusColor(item.status) + '40',
              }
            ]}>
              <TimeIcon size={12} color={getStatusColor(item.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        {canRespond && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.btn, styles.accept]} 
              onPress={() => respond(invitationId, true)}
            >
              <CheckIcon size={16} color="white" />
              <Text style={styles.btnText}>{t('invitations.accept', 'Accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btn, styles.decline]} 
              onPress={() => respond(invitationId, false)}
            >
              <CloseIcon size={16} color="white" />
              <Text style={styles.btnText}>{t('invitations.decline', 'Decline')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderInvitation}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl 
            tintColor={themeColors.primary} 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('invitations.empty', 'No invitations')}</Text>
            <Text style={styles.emptySubtext}>{t('invitations.emptyHint', "You'll see event invitations here")}</Text>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: string) => {
  const themeColors = theme === 'dark' ? darkColors : lightColors;
  return StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: themeColors.background 
    },
    card: { 
      backgroundColor: themeColors.surface, 
      borderRadius: 16, 
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeColors.muted,
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 18,
      fontWeight: '700',
      color: 'white',
    },
    username: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    title: { 
      color: themeColors.text, 
      fontSize: 18, 
      fontWeight: '700',
      marginBottom: 4,
    },
    creator: {
      color: themeColors.textSecondary,
      fontSize: 14,
      marginBottom: 12,
    },
    details: {
      marginTop: 8,
      marginBottom: 12,
      gap: 4,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    detailText: {
      color: themeColors.textSecondary,
      fontSize: 14,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      marginTop: 8,
      marginBottom: 12,
      gap: 6,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actions: { 
      flexDirection: 'row', 
      gap: 12,
      marginTop: 8,
    },
    btn: { 
      flex: 1,
      paddingVertical: 12, 
      paddingHorizontal: 16, 
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    accept: { 
      backgroundColor: themeColors.success,
    },
    decline: { 
      backgroundColor: themeColors.danger,
    },
    btnText: { 
      color: 'white', 
      fontWeight: '600',
      fontSize: 14,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
    },
  });
};


