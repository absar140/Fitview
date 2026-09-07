import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { mockGarments } from '../../services/mockGarments';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

// Placeholder color options for the swatch UI — not yet tied to real garment variants
const colorOptions = ['#FFFFFF', '#CFCFCF', '#1A1A1A'];

export default function ProductDetailScreen({ route, navigation }: Props) {
    const garment = mockGarments.find((g) => g.id === route.params.garmentId)!;
    const [selectedColor, setSelectedColor] = useState(0);

    return (
        <ScrollView style={styles.container} bounces={false}>
            <Image source={{ uri: garment.thumbnailUrl }} style={styles.image} />

            <View style={styles.infoCard}>
                <View style={styles.titleRow}>
                    <Text style={styles.name}>{garment.name}</Text>
                    <Text style={styles.price}>${garment.price}</Text>
                </View>
                <Text style={styles.subtitle}>premium sustainable collection</Text>

                <Text style={styles.sectionLabel}>SELECT COLOR</Text>
                <View style={styles.colorRow}>
                    {colorOptions.map((color, index) => (
                        <Pressable
                            key={color}
                            onPress={() => setSelectedColor(index)}
                            style={[
                                styles.colorSwatch,
                                { backgroundColor: color },
                                selectedColor === index && styles.colorSwatchSelected,
                            ]}
                        />
                    ))}
                </View>

                <Text style={styles.sectionLabel}>DESCRIPTION</Text>

                <Pressable
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate('TryOn', { garmentId: garment.id })}
                >
                    <Text style={styles.primaryButtonText}>try on now</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>add to cart</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    image: { width: '100%', aspectRatio: 0.85, backgroundColor: '#F1EFE8' },
    infoCard: { backgroundColor: '#F1EFE8', padding: 20, marginTop: -16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 20, fontWeight: '600', color: '#1A1A1A' },
    price: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    subtitle: { fontSize: 13, color: '#B08A5A', marginTop: 4, marginBottom: 20 },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: '#5F5E5A', letterSpacing: 0.5, marginBottom: 10, marginTop: 10 },
    colorRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D9D6CC' },
    colorSwatchSelected: { borderWidth: 2, borderColor: '#1A1A1A' },
    primaryButton: { backgroundColor: '#C1622F', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 10 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    secondaryButton: { backgroundColor: '#1A1A1A', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    secondaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});