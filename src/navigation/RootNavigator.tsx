import React from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import HomeScreen from '../features/home/HomeScreen';
import CategoriesScreen from '../features/categories/CategoriesScreen';
import TryOnScreen from '../features/tryon/TryOnScreen';
import FilamentTestScreen from '../features/tryon/FilamentTestScreen';
import CartScreen from '../features/cart/CartScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import ProductDetailScreen from '../features/product/ProductDetailScreen';
import CheckoutScreen from '../features/checkout/CheckoutScreen';
import OrderConfirmedScreen from '../features/checkout/OrderConfirmedScreen';
import CategoryListingScreen from '../features/categories/CategoryListingScreen';
import TrackOrderScreen from '../features/orders/TrackOrderScreen';
// LoginScreen and useAuth are no longer imported here — login now happens
// inline inside ProfileScreen, not as a separate gated route.

export type TabParamList = {
  Home: undefined;
  Shop: undefined;
  TryOnTab: undefined;
  Cart: undefined;
  Profile: undefined;
};


export type RootStackParamList = {
  Tabs: undefined;
  ProductDetail: { garmentId: string };
  TryOn: { garmentId: string };
  FilamentTest: undefined;        
  Checkout: undefined;
  OrderConfirmed: undefined;
  CategoryListing: { categoryId: string; categoryLabel: string };
  TrackOrder: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? '#FFFFFF' : '#A8A69E';

  return (
    <View
      style={{
        width: 40,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? '#1A1A1A' : 'transparent',
      }}
    >
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 24 : 16,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Shop"
        component={CategoriesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }}
      />
      <Tab.Screen
        name="TryOnTab"
        component={TryOnScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="body" focused={focused} /> }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="bag-handle" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// No more login gate — the app always starts on Tabs (Home).
// Login/signup now happens inside the Profile tab itself when needed,
// via useAuth() called directly inside ProfileScreen.tsx.
export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="TryOn" component={TryOnScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
        <Stack.Screen name="CategoryListing" component={CategoryListingScreen} />
        <Stack.Screen name="TrackOrder" component={TrackOrderScreen} />
        <Stack.Screen component={FilamentTestScreen} name="FilamentTest"/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}