import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { AppNavigator } from './src/navigation';
import { useAuthStore } from './src/state/auth';
import { getColors, setThemeMode } from './src/theme/colors';
import { usePreferences } from './src/state/preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const identify = useAuthStore((s) => s.identify);
  const { hydrate, theme } = usePreferences();
  
  // Handle OAuth callback on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOAuthCallback = async () => {
        const url = window.location.href;
        if (url.includes('/oauth-complete')) {
          console.log('[OAuth Callback] Processing OAuth callback URL:', url);
          
          try {
            // Parse URL parameters
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            const userId = urlObj.searchParams.get('userId');
            const username = urlObj.searchParams.get('username');
            const error = urlObj.searchParams.get('error');
            
            if (error) {
              console.error('[OAuth Callback] Error from OAuth:', error);
              // Clean up URL
              window.history.replaceState({}, document.title, '/');
              return;
            }
            
            if (token) {
              console.log('[OAuth Callback] Token received, storing and identifying user');
              // Store token
              await AsyncStorage.setItem('auth_token', token);
              
              // Update auth store state
              useAuthStore.setState({ token });
              
              // Identify user (this will also set the user)
              await identify();
              
              // Clean up URL - remove query parameters
              window.history.replaceState({}, document.title, '/');
              
              console.log('[OAuth Callback] OAuth callback processed successfully');
            }
          } catch (e) {
            console.error('[OAuth Callback] Error processing callback:', e);
            // Clean up URL even on error
            window.history.replaceState({}, document.title, '/');
          }
        }
      };
      
      handleOAuthCallback();
    }
  }, [identify]);
  
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
