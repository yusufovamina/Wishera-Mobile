import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { colors } from '../theme/colors';
import { endpoints, getApiClient } from '../api/client';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';

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
  const styles = useMemo(() => createStyles(), [theme]);
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
        <Text style={styles.title}>{item.title || 'Untitled Event'}</Text>
        {item.isCancelled && (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledText}>Cancelled</Text>
          </View>
        )}
      </View>
      
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}
      
      <View style={styles.metaContainer}>
        {item.eventDate && (
          <View style={styles.metaItem}>
            <CalendarIcon size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(item.eventDate)}</Text>
          </View>
        )}
        
        {item.eventTime && (
          <View style={styles.metaItem}>
            <TimeIcon size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatTime(item.eventTime)}</Text>
          </View>
        )}
        
        {item.location && (
          <View style={styles.metaItem}>
            <LocationIcon size={16} color={colors.textSecondary} />
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
          <CalendarIcon size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptySubtext}>Create your first event to get started!</Text>
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
              tintColor={colors.primary} 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading events...</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  listContent: {
    padding: 16,
  },
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 16, 
    padding: 16,
    shadowColor: colors.primary,
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
    color: colors.text, 
    fontSize: 18, 
    fontWeight: '700', 
    flex: 1,
    marginRight: 8,
  },
  cancelledBadge: {
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cancelledText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  typeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inviteeCount: {
    color: colors.textMuted,
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
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});


