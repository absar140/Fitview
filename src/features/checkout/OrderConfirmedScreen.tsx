import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function OrderConfirmedScreen() {
    const navigation = useNavigation<NavProp>();

    return (
        <View style={styles.container}>
            {/* Green circular checkmark badge */}
            <View style={styles.checkCircle}>
                <Text style={styles.checkIcon}>✓</Text>
            </View>

            <Text style={styles.title}>order confirmed</Text>
            <Text style={styles.subtitle}>
                thank you for your purchase. order #49281 is being processed and will be shipped shortly.
            </Text>

            {/* Small thumbnails of purchased items */}
            <View style={styles.card}>
                <View style={styles.thumbRow}>
                    <Image source={{ uri: 'https://placehold.co/150x180?text=Item+1' }} style={styles.thumb} />
                    <Image source={{ uri: 'https://placehold.co/150x180?text=Item+2' }} style={styles.thumb} />
                </View>
                <View style={styles.divider} />
                <View style={styles.deliveryRow}>
                    <View>
                        <Text style={styles.deliveryLabel}>DELIVERY ESTIMATE</Text>
                        <Text style={styles.deliveryValue}>sep 12 - sep 14, 2026</Text>
                    </View>
                </View>
            </View>

            {/* Navigates back to the root of the tab bar, resetting the stack so
          the user can't "go back" into the checkout flow after confirming */}
            <Pressable
                style={styles.trackButton}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            >
                <Text style={styles.trackButtonText}>track order</Text>
            </Pressable>

            <Pressable
                style={styles.continueButton}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            >
                <Text style={styles.continueButtonText}>continue shopping</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
    checkCircle: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: '#3A7D44',
        alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    checkIcon: { fontSize: 32, color: '#FFFFFF', fontWeight: '700' },
    title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
    subtitle: { fontSize: 14, color: '#5F5E5A', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    card: { width: '100%', backgroundColor: '#F1EFE8', borderRadius: 16, padding: 16, marginBottom: 32 },
    thumbRow: { flexDirection: 'row', gap: 10 },
    thumb: { width: 64, height: 78, borderRadius: 10, backgroundColor: '#E5E2D8' },
    divider: { height: 1, backgroundColor: '#E5E2D8', marginVertical: 14 },
    deliveryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    deliveryLabel: { fontSize: 11, fontWeight: '600', color: '#8A8778', letterSpacing: 0.5, marginBottom: 4 },
    deliveryValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    trackButton: { width: '100%', backgroundColor: '#1A1A1A', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    trackButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    continueButton: { width: '100%', backgroundColor: '#FFFFFF', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9D6CC' },
    continueButtonText: { color: '#1A1A1A', fontSize: 15, fontWeight: '600' },
});