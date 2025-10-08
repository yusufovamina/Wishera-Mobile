import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuthStore } from '../state/auth';

export const RegisterScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register, loading, error } = useAuthStore();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <Input label="Username" value={username} onChangeText={setUsername} placeholder="Your username" />
      <Input label="Password" value={password} onChangeText={setPassword} placeholder="Create a password" secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Register" onPress={() => register(username, password)} loading={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 16,
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  error: { color: colors.danger },
});


