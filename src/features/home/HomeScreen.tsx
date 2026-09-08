import React from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import { mockGarments } from '../../services/mockGarments';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useNavigation } from '@react-navigation/native';

// Typing the navigation object against the ROOT stack (not the tab stack),
// because tapping a product needs to push ProductDetail, which lives
// outside the tab navigator (see RootNavigator.tsx for the structure).
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
    // useNavigation() lets us navigate from inside a screen that's nested
    // inside the Tab Navigator, without needing navigation passed as a prop.
    const navigation = useNavigation<NavProp>();

    return (
        <View style={styles.container}>
            {/* Top header row: brand name on the left, icon button on the right.
          Matches the design's header layout on the Home screen. */}
            <View style={styles.headerRow}>
                <Text style={styles.brand}>fitview</Text>
                <View style={styles.headerIcon}>
                    <Text style={styles.headerIconText}>⛶</Text>
                </View>
            </View>

            {/* Main product grid.
          FlatList is used instead of ScrollView + map() because it's
          more performant for potentially long lists (only renders
          what's visible on screen). */}
            <FlatList
                data={mockGarments}
                numColumns={2} // renders items in a 2-column grid, like the design
                keyExtractor={(item) => item.id} // React needs a stable unique key per item
                columnWrapperStyle={styles.row} // controls spacing between the 2 columns
                contentContainerStyle={{ paddingBottom: 20 }} // breathing room at the bottom of the scroll
                renderItem={({ item }) => (
                    // Entire card is tappable — pressing anywhere on it opens Product Detail
                    <Pressable
                        style={styles.card}
                        onPress={() => navigation.navigate('ProductDetail', { garmentId: item.id })}
                    >
                        {/* Wrapping View lets us position the heart icon on top of the image
                using absolute positioning (see heartButton style below) */}
                        <View style={styles.imageWrapper}>
                            <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />

                            {/* Wishlist/heart icon — purely visual for now, not wired to any state.
                  Tapping it currently does nothing since there's no onPress handler. */}
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
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: 56, // pushes content below the phone's status bar
        paddingHorizontal: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // pushes brand text and icon to opposite ends
        alignItems: 'center',
        marginBottom: 20,
    },
    brand: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    headerIcon: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconText: {
        fontSize: 18,
        color: '#1A1A1A',
    },
    row: {
        justifyContent: 'space-between', // creates the gap between left/right cards in a row
        marginBottom: 8,
    },
    card: {
        width: '48%', // slightly under 50% so there's a visible gap between the two cards
        marginBottom: 20,
    },
    imageWrapper: {
        position: 'relative', // required so heartButton's "absolute" positioning is relative to this View, not the whole screen
    },
    image: {
        width: '100%',
        aspectRatio: 0.8, // controls image proportions (taller than wide, like product photos)
        borderRadius: 16,
        backgroundColor: '#F1EFE8', // shows as a placeholder color while the image loads
    },
    heartButton: {
        position: 'absolute', // takes it out of normal layout flow so it floats on top of the image
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16, // half of width/height = perfect circle
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        // subtle shadow so the white circle stands out against light-colored images
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2, // Android equivalent of shadow (iOS uses shadowColor/Opacity/Radius above)
    },
    heartIcon: {
        fontSize: 16,
        color: '#1A1A1A',
    },
    name: {
        fontSize: 14,
        marginTop: 8,
        color: '#1A1A1A',
    },
    price: {
        fontSize: 14,
        fontWeight: '500',
        color: '#5F5E5A', // muted gray, secondary to the name
        marginTop: 2,
    },
});