import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { mockGarments } from '../../services/mockGarments';
import { useCart } from '../../store/CartContext'; // ← new import
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

const colorNames = ['White', 'Gray', 'Black']; // matches the 3 swatches by index
const colorOptions = ['#FFFFFF', '#CFCFCF', '#1A1A1A'];

export default function ProductDetailScreen({ route, navigation }: Props) {
    const garment = mockGarments.find((g) => g.id === route.params.garmentId)!;
    const [selectedColor, setSelectedColor] = useState(0);
    const { addToCart } = useCart(); // ← pull the addToCart function from context

    const handleAddToCart = () => {
        // Size is hardcoded to 'M' for now since there's no size selector UI yet —
        // swap this out once a size picker is built.
        addToCart(garment, 'M', colorNames[selectedColor]);
        Alert.alert('Added to cart', `${garment.name} has been added to your cart.`);
    };

    return (
        <View style={styles.container}>
            <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
                <View style={styles.imageWrapper}>
                    <Image source={{ uri: garment.thumbnailUrl }} style={styles.image} />
                    <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backIcon}>‹</Text>
                    </Pressable>
                    <Pressable style={styles.heartButton}>
                        <Text style={styles.heartIcon}>♡</Text>
                    </Pressable>
                </View>

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
                    <Text style={styles.description}>
                        Crafted from sustainably sourced materials with a relaxed, comfortable fit.
                        Designed to move with you — from day to evening.
                    </Text>

                    <Pressable
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('TryOn', { garmentId: garment.id })}
                    >
                        <Text style={styles.primaryButtonText}>try on now</Text>
                    </Pressable>

                    {/* THIS is the actual fix — now calls handleAddToCart instead of doing nothing */}
                    <Pressable style={styles.secondaryButton} onPress={handleAddToCart}>
                        <Text style={styles.secondaryButtonText}>add to cart</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    imageWrapper: { position: 'relative' },
    image: { width: '100%', aspectRatio: 0.85, backgroundColor: '#F1EFE8' },
    backButton: { position: 'absolute', top: 50, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 22, color: '#1A1A1A', marginLeft: -2 },
    heartButton: { position: 'absolute', top: 50, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    heartIcon: { fontSize: 16, color: '#1A1A1A' },
    infoCard: { backgroundColor: '#F1EFE8', padding: 20, marginTop: -16, borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 20, fontWeight: '600', color: '#1A1A1A' },
    price: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    subtitle: { fontSize: 13, color: '#B08A5A', marginTop: 4, marginBottom: 20 },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: '#5F5E5A', letterSpacing: 0.5, marginBottom: 10, marginTop: 10 },
    colorRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D9D6CC' },
    colorSwatchSelected: { borderWidth: 2, borderColor: '#1A1A1A' },
    description: { fontSize: 13, color: '#5F5E5A', lineHeight: 20, marginBottom: 10 },
    primaryButton: { backgroundColor: '#C1622F', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 10 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    secondaryButton: { backgroundColor: '#1A1A1A', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    secondaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});