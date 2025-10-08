import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuthStore } from '../state/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Wishera</Text>
      <Input label="Username" value={username} onChangeText={setUsername} placeholder="Your username" />
      <Input label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Sign in" onPress={() => login(username, password)} loading={loading} />
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.switch}>Create account</Text>
      </TouchableOpacity>
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
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 16 },
  error: { color: colors.danger },
  switch: { color: colors.muted, textAlign: 'center', marginTop: 12 },
});


