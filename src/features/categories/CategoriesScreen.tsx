import React from 'react';
import { View, Text, FlatList, ImageBackground, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// categoryId must exactly match a `category` value used in mockGarments.ts,
// otherwise the CategoryListingScreen's filter will show zero results.
// Filenames below verified against the actual assets/categories folder contents.
const categories = [
  { id: 'dresses', label: 'dresses', image: require('../../../assets/categories/dresses.jpg') },
  { id: 'outerwear', label: 'outerwear', image: require('../../../assets/categories/outerwear.jpg') },
  { id: 'knitwear', label: 'knitwear', image: require('../../../assets/categories/knitwear.jpg') },
  { id: 'bags', label: 'bags', image: require('../../../assets/categories/bags.jpg') },
];

export default function CategoriesScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      {/* Header row: back arrow, centered title, menu icon */}
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Text style={styles.header}>categories</Text>
        <Pressable style={styles.iconButton}>
          <Text style={styles.iconText}>⋯</Text>
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={styles.banner}
            onPress={() =>
              navigation.navigate('CategoryListing', { categoryId: item.id, categoryLabel: item.label })
            }
          >
            <ImageBackground
              source={item.image}
              style={styles.bannerImage}
              imageStyle={styles.bannerImageRadius}
            >
              {/* Overlay stretches across the whole banner and centers its
                  content, so the title sits in the middle instead of the
                  bottom-left corner */}
              <View style={styles.overlay}>
                <Text style={styles.bannerLabel}>{item.label}</Text>
              </View>
            </ImageBackground>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#1A1A1A' },
  header: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  banner: {
    height: 170,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bannerImage: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerImageRadius: {
    borderRadius: 20,
  },
  overlay: {
    // Correct property name is 'absoluteFill' in this RN version's types.
    // Stretches to cover the entire banner, then centers content
    // both horizontally and vertically.
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLabel: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});