import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { useAuthStore } from './src/state/auth';
import { getColors, setThemeMode } from './src/theme/colors';
import { usePreferences } from './src/state/preferences';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

export default function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const { hydrate, theme } = usePreferences();
  
  useEffect(() => {
    // Hydrate preferences first, then auth (which will use theme)
    hydrate().then(() => {
      hydrateAuth();
    });
  }, [hydrate, hydrateAuth]);

  // Handle OAuth callback and password reset links on web platform
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleUrlParams = () => {
        const url = window.location.href;
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname;
        
        // Handle OAuth callback
        let token = parsedUrl.searchParams.get('token');
        let userId = parsedUrl.searchParams.get('userId');
        let username = parsedUrl.searchParams.get('username');
        
        // Also check hash fragments (some OAuth flows use hash)
        if (!token && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          token = hashParams.get('token') || token;
          userId = hashParams.get('userId') || userId;
          username = hashParams.get('username') || username;
        }
        
        // Check if this is OAuth callback
        if (path.includes('oauth-complete') && token) {
          console.log('[Web OAuth] OAuth callback detected:', { token: 'present', userId, username });
          AsyncStorage.setItem('auth_token', token).then(() => {
            // Use Zustand's setState method instead of direct mutation
            useAuthStore.setState({ token });
            useAuthStore.getState().identify().catch(err => {
              console.error('[Web OAuth] Failed to identify user after OAuth:', err);
            });
            // Remove the OAuth parameters from URL to clean up
            const cleanUrl = window.location.pathname || '/';
            window.history.replaceState({}, '', cleanUrl);
          });
        }
        // Check if this is password reset link
        else if (path.includes('reset-password') && token) {
          console.log('[Web] Password reset link detected, navigating to ResetPassword screen');
          // On web, we can navigate directly using React Navigation
          // The navigation will be handled by the navigation component
          // For now, just log - the navigation should handle it
        }
      };
      
      // Check immediately when component mounts
      handleUrlParams();
      
      // Listen for hash changes and popstate
      const handleHashChange = () => {
        handleUrlParams();
      };
      
      const handlePopState = () => {
        handleUrlParams();
      };
      
      window.addEventListener('hashchange', handleHashChange);
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  setThemeMode(theme);
  const c = getColors();
  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={c.background} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
