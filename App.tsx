import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { useAuthStore } from './src/state/auth';
import { getColors, setThemeMode } from './src/theme/colors';
import { usePreferences } from './src/state/preferences';

export default function App() {
  const identify = useAuthStore((s) => s.identify);
  const { hydrate, theme } = usePreferences();
  useEffect(() => {
    identify();
    hydrate();
  }, [identify, hydrate]);
  setThemeMode(theme);
  const c = getColors();
  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={c.background} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
