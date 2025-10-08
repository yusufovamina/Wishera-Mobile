import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { api, endpoints } from '../api/client';

type Wishlist = { id: string; title: string; description?: string; items: Gift[]; likes?: number };
type Gift = { id: string; name: string; price?: number; imageUrl?: string };

export const WishlistDetailScreen: React.FC<any> = ({ route }) => {
  const { id } = route.params as { id: string };
  const [data, setData] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [liking, setLiking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoints.wishlistById(id));
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const like = async () => {
    setLiking(true);
    try {
      await api.post(endpoints.wishlistLike(id));
      await load();
    } finally {
      setLiking(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading || !data) {
    return (
      <View style={styles.center}> 
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={{ margin: 16 }}>
        <Text style={styles.title}>{data.title}</Text>
        {data.description ? <Text style={styles.desc}>{data.description}</Text> : null}
        <TouchableOpacity onPress={like} style={styles.likeBtn} disabled={liking}>
          <Text style={styles.likeText}>{liking ? '...' : `❤ ${data.likes ?? 0}`}</Text>
        </TouchableOpacity>
      </Card>
      <FlatList
        data={data.items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        renderItem={({ item }) => (
          <Card>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.giftImage} /> : null}
            <Text style={styles.itemTitle}>{item.name}</Text>
            {item.price ? <Text style={styles.itemMeta}>{`$${item.price}`}</Text> : null}
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  desc: { color: colors.muted, marginTop: 6 },
  likeBtn: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  likeText: { color: colors.text },
  giftImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
  itemTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  itemMeta: { color: colors.muted, marginTop: 4 },
});


