import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors, getColors, setThemeMode } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { HomeIcon, ChatIcon, NotificationsIcon, ProfileIcon } from '../components/Icon';
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
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { useAuthStore } from '../state/auth';
import { useChatNotifications } from '../hooks/useChatNotifications';

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
  const { theme } = usePreferences();
  setThemeMode(theme);
  const navTheme = buildNavTheme();
  const { user, token } = useAuthStore();
  const isAuthenticated = !!(user && token);
  
  console.log('Navigation - Auth state:', { user, token, isAuthenticated });

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator 
        initialRouteName={isAuthenticated ? "Tabs" : "Landing"}
        screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
      >
        {isAuthenticated ? (
          // Authenticated user - show main app
          <>
            <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="WishlistDetail" component={WishlistDetailScreen} options={{ title: 'Wishlist' }} />
            <Stack.Screen 
              name="UserProfile" 
              component={ProfileScreen} 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen name="Followers" component={FollowersScreen} options={{ title: 'Followers' }} />
            <Stack.Screen name="Following" component={FollowingScreen} options={{ title: 'Following' }} />
            <Stack.Screen name="LikedWishlists" component={LikedWishlistsScreen} options={{ title: 'Liked Wishlists' }} />
            <Stack.Screen name="ReservedGifts" component={ReservedGiftsScreen} options={{ title: 'Reserved Gifts' }} />
            <Stack.Screen name="MyEvents" component={MyEventsScreen} options={{ title: 'My Events' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
            <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ title: 'Invitations' }} />
            <Stack.Screen name="UserWishlists" component={UserWishlistsScreen} options={{ title: 'My Wishlists' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
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

// Placeholder components for tabs

const TabIcon = ({ IconComponent, focused, label, styles, badgeCount }: { IconComponent: React.ComponentType<any>; focused: boolean; label: string; styles: any; badgeCount?: number }) => (
  <View style={styles.tabIconContainer}>
    <View style={[styles.tabIconCircle, focused && styles.tabIconCircleFocused]}>
      <IconComponent size={20} color={focused ? 'white' : colors.textSecondary} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </Text>
        </View>
      )}
    </View>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
  </View>
);

const TabsNavigator: React.FC = () => {
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  const { totalUnread: chatUnreadCount } = useChatNotifications();
  const [notificationUnreadCount, setNotificationUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const { userApi, endpoints } = require('../api/client');
        const { useAuthStore } = require('../state/auth');
        const { user } = useAuthStore.getState();
        if (user?.id) {
          const response = await userApi.get(endpoints.getNotifications(1, 1));
          const notifications = Array.isArray(response.data) 
            ? response.data 
            : (response.data?.items || response.data?.data || []);
          const unread = notifications.filter((n: any) => !n.isRead && !n.read).length;
          setNotificationUnreadCount(unread);
        }
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={HomeIcon} focused={focused} label="Home" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={ChatIcon} focused={focused} label="Chats" styles={styles} badgeCount={chatUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={NotificationsIcon} focused={focused} label="Notifications" styles={styles} badgeCount={notificationUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon IconComponent={ProfileIcon} focused={focused} label="Profile" styles={styles} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

const createStyles = () => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
    shadowColor: colors.primary,
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
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabIconCircleFocused: {
    backgroundColor: colors.primary,
  },
  tabIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabIconFocused: {
    color: 'white',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger || '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
});


