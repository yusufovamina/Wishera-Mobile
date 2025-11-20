import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { colors, lightColors, darkColors } from '../theme/colors';
import { endpoints, getApiClient } from '../api/client';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';
import { CalendarIcon, TimeIcon, LocationIcon } from '../components/Icon';

type EventItem = { 
  id: string; 
  title: string; 
  description?: string;
  eventDate?: string; 
  eventTime?: string; 
  location?: string;
  eventType?: string;
  isCancelled?: boolean;
  inviteeCount?: number;
};

export const MyEventsScreen: React.FC<any> = ({ navigation }) => {
  const { theme } = usePreferences();
  const { t } = useI18n();
  const themeColors = useMemo(() => theme === 'dark' ? darkColors : lightColors, [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<EventItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const eventApi = getApiClient(endpoints.myEvents(1, 50));
      console.log('Fetching my events from:', eventApi.defaults.baseURL + endpoints.myEvents(1, 50));
      const res = await eventApi.get(endpoints.myEvents(1, 50));
      console.log('My events response:', res.data);
      // Handle different response formats
      const data = res.data?.events || res.data?.items || res.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log('Failed to load my events:', e);
      console.log('Error response:', e?.response?.data);
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

  useEffect(() => { load(); }, []);

  // Refresh events when screen comes into focus (e.g., after editing an event)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation]);

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
    // Time is in HH:mm:ss format
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

  const renderEvent = ({ item }: { item: EventItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        navigation.navigate('EventDetail', { eventId: item.id });
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title || t('events.untitled', 'Untitled Event')}</Text>
        {item.isCancelled && (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledText}>{t('events.cancelled', 'Cancelled')}</Text>
          </View>
        )}
      </View>
      
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}
      
      <View style={styles.metaContainer}>
        {item.eventDate && (
          <View style={styles.metaItem}>
            <CalendarIcon size={16} color={themeColors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(item.eventDate)}</Text>
          </View>
        )}
        
        {item.eventTime && (
          <View style={styles.metaItem}>
            <TimeIcon size={16} color={themeColors.textSecondary} />
            <Text style={styles.metaText}>{formatTime(item.eventTime)}</Text>
          </View>
        )}
        
        {item.location && (
          <View style={styles.metaItem}>
            <LocationIcon size={16} color={themeColors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
          </View>
        )}
        
        {item.eventType && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.eventType}</Text>
          </View>
        )}
      </View>
      
      {item.inviteeCount !== undefined && item.inviteeCount > 0 && (
        <Text style={styles.inviteeCount}>{item.inviteeCount} {item.inviteeCount === 1 ? 'invitee' : 'invitees'}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {items.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <CalendarIcon size={48} color={themeColors.textSecondary} />
          <Text style={styles.emptyText}>{t('events.empty', 'No events yet')}</Text>
          <Text style={styles.emptySubtext}>{t('events.emptyHint', 'Create your first event to get started!')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              tintColor={themeColors.primary} 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>{t('events.loading', 'Loading events...')}</Text>
              </View>
            ) : null
          }
        />
      )}
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
  listContent: {
    padding: 16,
  },
    card: { 
      backgroundColor: themeColors.surface, 
      borderRadius: 16, 
      padding: 16,
      shadowColor: themeColors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    title: { 
      color: themeColors.text, 
      fontSize: 18, 
      fontWeight: '700', 
      flex: 1,
      marginRight: 8,
    },
    cancelledBadge: {
      backgroundColor: themeColors.danger + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    cancelledText: {
      color: themeColors.danger,
      fontSize: 12,
      fontWeight: '600',
    },
    description: {
      color: themeColors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    metaContainer: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaText: {
      color: themeColors.textSecondary,
      fontSize: 14,
      flex: 1,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      backgroundColor: themeColors.primary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 8,
    },
    typeText: {
      color: themeColors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    inviteeCount: {
      color: themeColors.textMuted,
      fontSize: 12,
      marginTop: 8,
    },
    separator: {
      height: 12,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: themeColors.textSecondary,
    },
  });
};


