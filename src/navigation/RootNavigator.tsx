import React from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Vector icon library — gives us real crisp icons instead of unicode text symbols.
// Requires linking on Android (see build.gradle step) and a rebuild after install.
import Ionicons from 'react-native-vector-icons/Ionicons';

import HomeScreen from '../features/home/HomeScreen';
import CategoriesScreen from '../features/categories/CategoriesScreen';
import TryOnScreen from '../features/tryon/TryOnScreen';
import CartScreen from '../features/cart/CartScreen';
import ProfileScreen from '../features/profile/ProfileScreen';
import ProductDetailScreen from '../features/product/ProductDetailScreen';
import CheckoutScreen from '../features/checkout/CheckoutScreen';
import OrderConfirmedScreen from '../features/checkout/OrderConfirmedScreen';
import CategoryListingScreen from '../features/categories/CategoryListingScreen';
// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

// Route names + expected params for each tab inside the bottom tab bar.
// 'undefined' means that screen doesn't require any params to navigate to it.
export type TabParamList = {
    Home: undefined;
    Shop: undefined;
    TryOnTab: undefined; // named differently from the "TryOn" stack screen below —
    // this is just the placeholder tab, not the real full AR flow
    Cart: undefined;
    Profile: undefined;
};

// Route names + params for the OUTER stack, which wraps the entire tab bar
// as a single screen ("Tabs"), plus two screens that intentionally hide
// the tab bar when shown: ProductDetail and TryOn.
export type RootStackParamList = {
    Tabs: undefined;
    ProductDetail: { garmentId: string };
    TryOn: { garmentId: string };
    Checkout: undefined;
    OrderConfirmed: undefined;
    CategoryListing: { categoryId: string; categoryLabel: string };
};

// ---------------------------------------------------------------------------
// NAVIGATOR INSTANCES
// ---------------------------------------------------------------------------

// Two separate navigator instances — one for the 5 tabs, one for the outer stack.
// They get combined together in RootNavigator() at the bottom of this file.
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// TAB ICON COMPONENT
// ---------------------------------------------------------------------------

// Renders one tab's icon, with a small rounded dark "pill" background
// appearing behind it only when that tab is the currently active one.
// This is a common modern nav-bar pattern (used by many production apps)
// that visually communicates "you are here" without needing text labels.
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
    // White icon color when active (sits on the dark pill background),
    // muted gray when inactive (sits on transparent background).
    const color = focused ? '#FFFFFF' : '#A8A69E';

    return (
        <View
            style={{
                width: 40,
                height: 32,
                borderRadius: 16, // fully rounded pill shape
                alignItems: 'center',
                justifyContent: 'center',
                // Only show the dark background when this specific tab is active;
                // inactive tabs get a transparent background so only the icon shows.
                backgroundColor: focused ? '#1A1A1A' : 'transparent',
            }}
        >
            <Ionicons name={name} size={20} color={color} />
        </View>
    );
}

// ---------------------------------------------------------------------------
// BOTTOM TAB NAVIGATOR
// ---------------------------------------------------------------------------

// Defines the actual 5-tab bar and which screen each tab renders.
function Tabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                // We build our own headers inside each screen component instead of
                // using React Navigation's default header bar, so hide it here.
                headerShown: false,

                // Text labels are skipped entirely — the active pill background
                // (see TabIcon above) already communicates which tab is selected,
                // so labels would be redundant clutter.
                tabBarShowLabel: false,

                tabBarStyle: {
                    // "absolute" positioning + left/right/bottom offsets makes the bar
                    // float above the screen content, rather than sitting flush against
                    // the very bottom edge — gives it a modern "floating dock" look.
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: Platform.OS === 'ios' ? 24 : 16, // extra bottom margin on iOS to clear the home indicator
                    height: 60,
                    borderRadius: 30, // fully rounded pill-shaped bar
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 0, // no border needed since the bar floats rather than sitting flush at the screen edge

                    // Soft drop shadow so the floating bar visually separates from
                    // whatever content is scrolling underneath it.
                    elevation: 8, // shadow on Android
                    shadowColor: '#000', // shadow on iOS (next 3 lines)
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                },

                // Ensures each tab's icon is centered within its slot on the bar
                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                },
            }}
        >
            {/* Each Tab.Screen pairs a route name with the component it renders,
          and tabBarIcon controls what shows in the bottom bar for that tab. */}
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

// ---------------------------------------------------------------------------
// ROOT NAVIGATOR (default export)
// ---------------------------------------------------------------------------

// Wraps the entire 5-tab experience as a single "Tabs" screen inside an
// outer Stack Navigator. This lets ProductDetail and TryOn be pushed ON TOP
// of the tabs as full-screen views — which automatically hides the floating
// tab bar underneath them, matching the design (product detail and the
// try-on camera screen don't show bottom navigation).
export default function RootNavigator() {
    return (
        // NavigationContainer must wrap the entire navigation tree — required
        // once at the top level, not per-navigator.
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Tabs" component={Tabs} />
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                <Stack.Screen name="TryOn" component={TryOnScreen} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} />
                <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
                <Stack.Screen name="CategoryListing" component={CategoryListingScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}