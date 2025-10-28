import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { useAuthStore } from './src/state/auth';
import { colors } from './src/theme/colors';

export default function App() {
  const identify = useAuthStore((s) => s.identify);
  useEffect(() => {
    identify();
  }, [identify]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
