import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { endpoints, userApi } from '../api/client';

type InvitationItem = { id: string; eventTitle: string; status?: string };

export const InvitationsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InvitationItem[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await userApi.get(endpoints.myInvitations(1, 50));
      setItems(res.data?.items || res.data || []);
    } catch (e) {
      console.log('Failed to load invitations:', e);
    } finally {
      setLoading(false);
    }
  };

  const respond = async (invitationId: string, accept: boolean) => {
    try {
      await userApi.post(endpoints.respondInvitation(invitationId), { status: accept ? 'accepted' : 'declined' });
      load();
    } catch (e) {
      console.log('Respond failed:', e);
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
            <Text style={styles.title}>{item.eventTitle}</Text>
            <Text style={styles.meta}>{item.status || 'pending'}</Text>
            <View style={{ height: 8 }} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => respond(item.id, true)}>
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.decline]} onPress={() => respond(item.id, false)}>
                <Text style={styles.btnText}>Decline</Text>
              </TouchableOpacity>
            </View>
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
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  accept: { backgroundColor: colors.primary },
  decline: { backgroundColor: colors.danger },
  btnText: { color: 'white', fontWeight: '700' },
});


