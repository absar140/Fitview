import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CatalogScreen from '../features/catalog/CatalogScreen';
import ProductDetailScreen from '../features/product/ProductDetailScreen';
import TryOnScreen from '../features/tryon/TryOnScreen';
export type RootStackParamList = {
    Catalog: undefined;
    ProductDetail: { garmentId: string };
    TryOn: { garmentId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Catalog" component={CatalogScreen} />
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                <Stack.Screen name="TryOn" component={TryOnScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}