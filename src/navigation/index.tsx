import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { colors, getColors, setThemeMode } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { useI18n } from '../i18n';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../state/auth';
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { VerifyCodeScreen } from '../screens/VerifyCodeScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WishlistDetailScreen } from '../screens/WishlistDetailScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FollowersScreen } from '../screens/FollowersScreen';
import { FollowingScreen } from '../screens/FollowingScreen';
import { LikedWishlistsScreen } from '../screens/LikedWishlistsScreen';
import { ReservedGiftsScreen } from '../screens/ReservedGiftsScreen';
import { MyEventsScreen } from '../screens/MyEventsScreen';
import { InvitationsScreen } from '../screens/InvitationsScreen';
import { UserWishlistsScreen } from '../screens/UserWishlistsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const buildNavTheme = () => {
  const c = getColors();
  return {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      backgroundColor: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
      primary: c.primary,
    },
  } as any;
};

export const AppNavigator: React.FC = () => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  setThemeMode(theme);
  const navTheme = buildNavTheme();
  const { user, token } = useAuthStore();
  const isAuthenticated = !!(user && token);
  const c = getColors();
  const navigationRef = useRef<any>(null);
  
  console.log('Navigation - Auth state:', { user, token, isAuthenticated });

  // Handle deep links for password reset and OAuth
  useEffect(() => {
    // Handle web platform URLs
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebUrl = () => {
        const url = window.location.href;
        const path = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('token');
        
        // Handle reset password on web
        if (path.includes('reset-password') && token) {
          console.log('[Web Navigation] Reset password URL detected');
          setTimeout(() => {
            if (navigationRef.current) {
              navigationRef.current.navigate('ResetPassword', { token });
            }
          }, 500);
        }
      };
      
      // Check on mount
      handleWebUrl();
      
      // Also listen for popstate (back/forward)
      window.addEventListener('popstate', handleWebUrl);
      return () => window.removeEventListener('popstate', handleWebUrl);
    }

    // Handle native platform deep links
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[Deep Link] Initial URL:', url);
        // Wait for navigation to be ready
        setTimeout(() => {
          handleDeepLink(url);
        }, 500);
      }
    }).catch(err => {
      console.error('[Deep Link] Error getting initial URL:', err);
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    console.log('[Deep Link] Received URL:', url);
    const parsedUrl = Linking.parse(url);
    console.log('[Deep Link] Parsed URL:', JSON.stringify(parsedUrl, null, 2));
    
    // Extract path - handle both 'reset-password' and '/reset-password' formats
    const path = parsedUrl.path || parsedUrl.pathname || '';
    const normalizedPath = path.replace(/^\//, ''); // Remove leading slash
    
    console.log('[Deep Link] Normalized path:', normalizedPath);
    
    // Handle OAuth callback: wishera://oauth-complete?token=xxx&userId=xxx&username=xxx
    if (normalizedPath === 'oauth-complete' || normalizedPath.includes('oauth-complete')) {
      const token = parsedUrl.queryParams?.token as string;
      const userId = parsedUrl.queryParams?.userId as string;
      const username = parsedUrl.queryParams?.username as string;
      
      console.log('[Deep Link] OAuth callback detected:', { token: token ? 'present' : 'missing', userId, username });
      
      if (token) {
        // Store token and identify user
        AsyncStorage.setItem('auth_token', token).then(() => {
          // Use Zustand's setState method instead of direct mutation
          useAuthStore.setState({ token });
          useAuthStore.getState().identify().catch(err => {
            console.error('[Deep Link] Failed to identify user after OAuth:', err);
          });
        });
      }
    }
    // Handle reset password deep link: wishera://reset-password?token=xxx
    // or https://yourdomain.com/reset-password?token=xxx
    else if (normalizedPath === 'reset-password' || normalizedPath.includes('reset-password')) {
      const resetToken = parsedUrl.queryParams?.token as string;
      console.log('[Deep Link] Reset password detected:', { token: resetToken ? 'present' : 'missing' });
      
      if (resetToken) {
        // Wait a bit for navigation to be ready, then navigate
        setTimeout(() => {
          if (navigationRef.current) {
            console.log('[Deep Link] Navigating to ResetPassword screen with token');
            navigationRef.current.navigate('ResetPassword', { token: resetToken });
          } else {
            console.error('[Deep Link] Navigation ref not ready');
          }
        }, 100);
      } else {
        console.error('[Deep Link] Reset password link missing token');
      }
    } else {
      console.log('[Deep Link] Unknown deep link path:', normalizedPath);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text }}>
        {isAuthenticated ? (
          // Authenticated user - show main app
          <>
            <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="WishlistDetail" component={WishlistDetailScreen} options={{ title: t('navigation.wishlist', 'Wishlist') }} />
            <Stack.Screen name="Followers" component={FollowersScreen} options={{ title: t('navigation.followers', 'Followers') }} />
            <Stack.Screen name="Following" component={FollowingScreen} options={{ title: t('navigation.following', 'Following') }} />
            <Stack.Screen name="LikedWishlists" component={LikedWishlistsScreen} options={{ title: t('navigation.likedWishlists', 'Liked Wishlists') }} />
            <Stack.Screen name="ReservedGifts" component={ReservedGiftsScreen} options={{ title: t('navigation.reservedGifts', 'Reserved Gifts') }} />
            <Stack.Screen name="MyEvents" component={MyEventsScreen} options={{ title: t('navigation.myEvents', 'My Events') }} />
            <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ title: t('navigation.invitations', 'Invitations') }} />
            <Stack.Screen name="UserWishlists" component={UserWishlistsScreen} options={{ title: t('navigation.myWishlists', 'My Wishlists') }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('navigation.settings', 'Settings') }} />
          </>
        ) : (
          // Not authenticated - show auth screens
          <>
            <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
            <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};


const TabsNavigator: React.FC = () => {
  const { t } = useI18n();
  const { theme } = usePreferences();
  const c = getColors();
  const styles = React.useMemo(() => createTabStyles(c), [theme]);
  
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
      }}
    >
      <Tabs.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" focused={focused} label={t('tabs.home', 'Home')} styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" focused={focused} label={t('tabs.chats', 'Chats')} styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔔" focused={focused} label={t('tabs.notifications', 'Notifications')} styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" focused={focused} label={t('tabs.profile', 'Profile')} styles={styles} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

// Custom tab bar icon component
const TabIcon = ({ icon, focused, label, styles }: { icon: string; focused: boolean; label: string; styles: any }) => {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.tabIconCircle, focused && styles.tabIconCircleFocused]}>
        <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
};

const createTabStyles = (c: ReturnType<typeof getColors>) => StyleSheet.create({
  tabBar: {
    backgroundColor: c.surface,
    borderTopColor: c.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabIconCircleFocused: {
    backgroundColor: c.primary,
  },
  tabIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textSecondary,
  },
  tabIconFocused: {
    color: 'white',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textMuted,
  },
  tabLabelFocused: {
    color: c.primary,
    fontWeight: '600',
  },
});


