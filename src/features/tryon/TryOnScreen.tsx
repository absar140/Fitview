import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

type Props = {
    route?: {
        params?: {
            garmentId?: string;
        };
    };
    navigation?: {
        goBack: () => void;
        canGoBack?: () => boolean;
    };
};

export default function TryOnScreen({ route, navigation }: Props) {
    const garmentId = route?.params?.garmentId;
    const canGoBack = navigation?.canGoBack ? navigation.canGoBack() : false;

    return (
        <View style={styles.container}>
            {canGoBack && (
                <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </Pressable>
            )}
            <Text style={styles.title}>Virtual Try-On</Text>
            {garmentId ? (
                <Text style={styles.subtitle}>Garment ID: {garmentId}</Text>
            ) : (
                <Text style={styles.subtitle}>Camera + AR try-on (Select a garment to begin)</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000', paddingTop: 60, paddingHorizontal: 16 },
    backButton: { marginBottom: 16 },
    backButtonText: { fontSize: 16, color: '#FFFFFF' },
    title: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#8E8E93' },
});
