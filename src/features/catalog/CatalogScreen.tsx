import React from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import { mockGarments } from '../../services/mockGarments';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Catalog'>;

export default function CatalogScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            {/* lowercase brand header, matches design */}
            <Text style={styles.brand}>fitview</Text>

            <FlatList
                data={mockGarments}
                numColumns={2}
                keyExtractor={(item) => item.id}
                columnWrapperStyle={styles.row}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.card}
                        onPress={() => navigation.navigate('ProductDetail', { garmentId: item.id })}
                    >
                        <View style={styles.imageWrapper}>
                            <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
                            {/* heart/wishlist icon overlay — not wired to any logic yet */}
                            <View style={styles.heartButton}>
                                <Text style={styles.heartIcon}>♡</Text>
                            </View>
                        </View>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.price}>${item.price}</Text>
                    </Pressable>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 60, paddingHorizontal: 16 },
    brand: { fontSize: 22, fontWeight: '600', marginBottom: 20, color: '#1A1A1A' },
    row: { justifyContent: 'space-between', marginBottom: 8 },
    card: { width: '48%', marginBottom: 20 },
    imageWrapper: { position: 'relative' },
    image: { width: '100%', aspectRatio: 0.8, borderRadius: 16, backgroundColor: '#F1EFE8' },
    heartButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartIcon: { fontSize: 16, color: '#1A1A1A' },
    name: { fontSize: 14, marginTop: 8, color: '#1A1A1A' },
    price: { fontSize: 14, fontWeight: '500', color: '#5F5E5A', marginTop: 2 },
});