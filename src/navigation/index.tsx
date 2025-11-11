import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors, getColors, setThemeMode } from '../theme/colors';
import { usePreferences } from '../state/preferences';
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
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
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Placeholder components for tabs

// Custom tab bar icon component
const TabIcon = ({ icon, focused, label, styles }: { icon: string; focused: boolean; label: string; styles: any }) => (
  <View style={styles.tabIconContainer}>
    <View style={[styles.tabIconCircle, focused && styles.tabIconCircleFocused]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
    </View>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
  </View>
);

const TabsNavigator: React.FC = () => {
  const { theme } = usePreferences();
  const styles = React.useMemo(() => createStyles(), [theme]);
  
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
            <TabIcon icon="🏠" focused={focused} label="Home" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" focused={focused} label="Chats" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔔" focused={focused} label="Notifications" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" focused={focused} label="Profile" styles={styles} />
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
});


