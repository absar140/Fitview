import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TryOn'>;

export default function TryOnScreen({ route, navigation }: Props) {
    const { garmentId } = route.params;

    return (
        <View style={styles.container}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Virtual Try-On</Text>
            <Text style={styles.subtitle}>Garment ID: {garmentId}</Text>
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
