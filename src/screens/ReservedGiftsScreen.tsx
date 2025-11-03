import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors } from '../theme/colors';
import { endpoints, wishlistApi } from '../api/client';

type GiftItem = { id: string; name: string; price?: number; category?: string; wishlistId?: string };

export const ReservedGiftsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GiftItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(endpoints.reservedGifts);
      setItems(res.data || []);
    } catch (e) {
      console.log('Failed to load reserved gifts:', e);
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
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>{item.category || 'General'}{typeof item.price === 'number' ? ` · $${item.price}` : ''}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  meta: { color: colors.textSecondary, fontSize: 12 },
});


