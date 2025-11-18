import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { endpoints, wishlistApi } from '../api/client';

type WishlistFeedItem = {
  id: string;
  title: string;
  description?: string | null;
  likeCount?: number;
  commentCount?: number;
  username?: string;
};

export const LikedWishlistsScreen: React.FC<any> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WishlistFeedItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await wishlistApi.get(endpoints.likedWishlists(1, 50));
      setItems(res.data || []);
    } catch (e) {
      console.log('Failed to load liked wishlists:', e);
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
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <HeartIcon size={14} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.likeCount ?? 0}</Text>
              </View>
              <View style={styles.metaItem}>
                <ChatIcon size={14} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.commentCount ?? 0}</Text>
              </View>
              <Text style={styles.metaText}>by @{item.username || 'user'}</Text>
            </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  desc: { color: colors.textSecondary, fontSize: 14, marginBottom: 6 },
  meta: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});


