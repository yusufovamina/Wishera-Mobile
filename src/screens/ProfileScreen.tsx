import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { api, endpoints } from '../api/client';

export const ProfileScreen: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get(endpoints.identification).then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {data ? (
        <>
          <Text style={styles.row}>ID: {data.id ?? data.userId ?? '—'}</Text>
          <Text style={styles.row}>Username: {data.username ?? data.name ?? '—'}</Text>
        </>
      ) : (
        <Text style={styles.row}>No profile data</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  row: { color: colors.muted, marginTop: 6 },
});


