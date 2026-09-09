import React from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { mockGarments } from '../../services/mockGarments';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CategoryListing'>;

export default function CategoryListingScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { categoryId, categoryLabel } = route.params;

  // Filters the full garment list down to just this category
  const filteredGarments = mockGarments.filter((g) => g.category === categoryId);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Text style={styles.header}>{categoryLabel}</Text>
        <Pressable style={styles.iconButton}>
          <Text style={styles.iconText}>⋯</Text>
        </Pressable>
      </View>

      {filteredGarments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No items in this category yet</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGarments}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ProductDetail', { garmentId: item.id })}
            >
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
                <View style={styles.heartButton}>
                  <Text style={styles.heartIcon}>♡</Text>
                </View>
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>${item.price}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#1A1A1A' },
  header: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#8A8778' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  row: { justifyContent: 'space-between', marginBottom: 8 },
  card: { width: '48%', marginBottom: 20 },
  imageWrapper: { position: 'relative' },
  image: { width: '100%', aspectRatio: 0.8, borderRadius: 16, backgroundColor: '#F1EFE8' },
  heartButton: {
    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  heartIcon: { fontSize: 16, color: '#1A1A1A' },
  name: { fontSize: 14, marginTop: 8, color: '#1A1A1A' },
  price: { fontSize: 14, fontWeight: '500', color: '#5F5E5A', marginTop: 2 },
});