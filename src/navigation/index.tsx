import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WishlistDetailScreen } from '../screens/WishlistDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { useAuthStore } from '../state/auth';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export const AppNavigator: React.FC = () => {
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
const ChatsScreen = () => (
  <View style={styles.placeholderContainer}>
    <View style={styles.placeholderIconCircle}>
      <Text style={styles.placeholderIconText}>Msg</Text>
    </View>
    <Text style={styles.placeholderTitle}>Chats</Text>
    <Text style={styles.placeholderSubtitle}>Connect with friends and family</Text>
  </View>
);

const NotificationsScreen = () => (
  <View style={styles.placeholderContainer}>
    <View style={styles.placeholderIconCircle}>
      <Text style={styles.placeholderIconText}>Ntf</Text>
    </View>
    <Text style={styles.placeholderTitle}>Notifications</Text>
    <Text style={styles.placeholderSubtitle}>Stay updated with activity</Text>
  </View>
);

// Custom tab bar icon component
const TabIcon = ({ icon, focused, label }: { icon: string; focused: boolean; label: string }) => (
  <View style={styles.tabIconContainer}>
    <View style={[styles.tabIconCircle, focused && styles.tabIconCircleFocused]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
    </View>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
  </View>
);

const TabsNavigator: React.FC = () => {
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
            <TabIcon icon="H" focused={focused} label="Home" />
          ),
        }}
      />
      <Tabs.Screen 
        name="Chats" 
        component={ChatsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="C" focused={focused} label="Chats" />
          ),
        }}
      />
      <Tabs.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="N" focused={focused} label="Notifications" />
          ),
        }}
      />
      <Tabs.Screen 
        name="Menu" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="M" focused={focused} label="Menu" />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 40,
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
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


