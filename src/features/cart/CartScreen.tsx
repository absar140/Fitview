import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useCart } from '../../store/CartContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const navigation = useNavigation<NavProp>();
  // Pulls real, shared cart state instead of local mock data —
  // this is what makes the cart actually reflect what buyers add.
  const { items, removeFromCart, updateQuantity, subtotal } = useCart();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>your cart ({items.length})</Text>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>your cart is empty</Text>
          <Text style={styles.emptySubtext}>items you add will show up here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.id}-${item.size}-${item.color}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
              <View style={styles.details}>
                <View style={styles.titleRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Pressable onPress={() => removeFromCart(item.id)} hitSlop={8}>
                    <Text style={styles.deleteIcon}>🗑</Text>
                  </Pressable>
                </View>
                <Text style={styles.meta}>SIZE: {item.size} | COLOR: {item.color}</Text>
                <View style={styles.bottomRow}>
                  <Text style={styles.price}>${item.price}</Text>
                  <View style={styles.stepper}>
                    <Pressable style={styles.stepperButton} onPress={() => updateQuantity(item.id, -1)}>
                      <Text style={styles.stepperText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{item.quantity}</Text>
                    <Pressable style={styles.stepperButton} onPress={() => updateQuantity(item.id, 1)}>
                      <Text style={styles.stepperText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>shipping</Text>
                <Text style={styles.summaryValueFree}>free</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>total</Text>
                <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
              </View>
            </View>
          }
        />
      )}

      {items.length > 0 && (
        <Pressable style={styles.checkoutButton} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.checkoutButtonText}>checkout</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  header: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1A1A1A' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#8A8778' },
  listContent: { paddingHorizontal: 16, paddingBottom: 140 },
  card: { flexDirection: 'row', backgroundColor: '#F1EFE8', borderRadius: 16, padding: 12, marginBottom: 12 },
  image: { width: 72, height: 90, borderRadius: 10, backgroundColor: '#E5E2D8' },
  details: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', flex: 1, marginRight: 8 },
  deleteIcon: { fontSize: 16 },
  meta: { fontSize: 12, color: '#8A8778', marginTop: 4 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  price: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 4 },
  stepperButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontSize: 16, color: '#1A1A1A' },
  stepperValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', minWidth: 20, textAlign: 'center' },
  summary: { marginTop: 8, paddingTop: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#5F5E5A' },
  summaryValue: { fontSize: 14, color: '#1A1A1A' },
  summaryValueFree: { fontSize: 14, color: '#3A7D44', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#EDEBE4', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  checkoutButton: { position: 'absolute', left: 16, right: 16, bottom: 96, backgroundColor: '#1A1A1A', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  checkoutButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});