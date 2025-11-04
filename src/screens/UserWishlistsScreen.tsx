import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getColors } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { endpoints, wishlistApi } from '../api/client';

type WishlistFeedItem = { id: string; title: string; description?: string | null };

export const UserWishlistsScreen: React.FC<any> = ({ route, navigation }) => {
  const { userId } = route.params as { userId: string };
  const { theme } = usePreferences();
  const colors = useMemo(() => getColors(), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WishlistFeedItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(endpoints.userWishlists(userId, 1, 50));
      setItems(res.data || []);
    } catch (e) {
      console.log('Failed to load user wishlists:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          </TouchableOpacity>
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
  desc: { color: colors.textSecondary, fontSize: 14 },
});


