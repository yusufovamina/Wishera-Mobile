import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { endpoints, userApi } from '../api/client';

type EventItem = { id: string; title: string; eventDate?: string; eventTime?: string; isCancelled?: boolean };

export const MyEventsScreen: React.FC = () => {
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EventItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await userApi.get(endpoints.myEvents(1, 50));
      setItems(res.data?.items || res.data || []);
    } catch (e) {
      console.log('Failed to load my events:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.eventDate || ''} {item.eventTime || ''} {item.isCancelled ? '· Cancelled' : ''}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={load}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  meta: { color: colors.textSecondary, fontSize: 12 },
});


