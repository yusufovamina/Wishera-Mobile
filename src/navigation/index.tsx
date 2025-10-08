import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}>
        <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="WishlistDetail" component={WishlistDetailScreen} options={{ title: 'Wishlist' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const Placeholder = (title: string) => () => (
  <></>
);

const TabsNavigator: React.FC = () => {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tabs.Screen name="Chats" component={Placeholder('Chats')} />
      <Tabs.Screen name="Notifications" component={Placeholder('Notifications')} />
      <Tabs.Screen name="Menu" component={ProfileScreen} options={{ title: 'Menu' }} />
    </Tabs.Navigator>
  );
};


