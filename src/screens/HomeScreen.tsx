import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Image, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { api, endpoints } from '../api/client';
import { useAuthStore } from '../state/auth';

type WishlistCard = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  likes?: number;
  itemsCount?: number;
  ownerName?: string;
};

const mockStories = new Array(8).fill(null).map((_, i) => ({ id: String(i + 1), name: ['You','Sally','Jason','Jena','Michael','Liam','Ava','Noah'][i % 8] }));

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const [data, setData] = useState<WishlistCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useAuthStore();

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoints.wishlistsFeed, { params: { page: 1, pageSize: 20 } });
      setData(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, []);

  const renderItem = ({ item }: { item: WishlistCard }) => (
    <TouchableOpacity onPress={() => navigation.navigate('WishlistDetail', { id: item.id })}>
      <Card style={styles.card}>
        {item.coverImageUrl ? <Image source={{ uri: item.coverImageUrl }} style={styles.cover} /> : null}
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{item.ownerName ?? ''}</Text>
          <Text style={styles.meta}>{(item.itemsCount ?? 0) + ' items'}</Text>
          <Text style={styles.meta}>{'❤ ' + (item.likes ?? 0)}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const ListHeader = useMemo(() => (
    <View>
      {/* Top app bar */}
      <View style={styles.appBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.avatar} />
          <Text style={styles.appName}>App name</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={styles.iconDot} />
          <View style={styles.iconDot} />
        </View>
      </View>

      {/* Stories row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
        {mockStories.map((s, idx) => (
          <View key={s.id} style={styles.storyItem}>
            <View style={[styles.storyCircle, idx === 0 && styles.storyAdd]}> {idx === 0 ? <Text style={styles.plus}>+</Text> : null} </View>
            <Text style={styles.storyName} numberOfLines={1}>{s.name}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={ListHeader}
      />
      <TouchableOpacity onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.card },
  appName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  iconDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.card },
  storiesRow: { paddingVertical: 12, gap: 18, alignItems: 'center' },
  storyItem: { width: 58, alignItems: 'center' },
  storyCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  plus: { color: colors.text, fontSize: 22, fontWeight: '800' },
  storyAdd: { borderColor: colors.primary },
  storyName: { color: colors.muted, fontSize: 12, marginTop: 6 },
  divider: { height: 8, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderLeftWidth: 0, borderRightWidth: 0, marginHorizontal: -16 },
  card: { overflow: 'hidden' },
  cover: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  desc: { color: colors.muted, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  meta: { color: colors.muted, fontSize: 12 },
  logout: { position: 'absolute', right: 16, bottom: 28, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface },
  logoutText: { color: colors.muted },
});


