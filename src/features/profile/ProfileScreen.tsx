import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';

// Mock user data — replace with real auth/user data once a backend exists
const user = {
  name: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  avatarUrl: 'https://placehold.co/200x200?text=AJ',
};

// Menu items shown in the profile list. Each is just a label + icon for now;
// onPress handlers can be wired up once the corresponding screens exist
// (e.g. Order History, Saved Items, Addresses, Payment Methods, Settings).
const menuItems = [
  { id: 'orders', label: 'order history', icon: '📦' },
  { id: 'saved', label: 'saved items', icon: '♡' },
  { id: 'addresses', label: 'shipping addresses', icon: '📍' },
  { id: 'payment', label: 'payment methods', icon: '💳' },
  { id: 'settings', label: 'settings', icon: '⚙' },
  { id: 'help', label: 'help & support', icon: '❓' },
];

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>profile</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User info card */}
        <View style={styles.userCard}>
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>

        {/* Edit profile button */}
        <Pressable style={styles.editButton}>
          <Text style={styles.editButtonText}>edit profile</Text>
        </Pressable>

        {/* Menu list */}
        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.menuItemLast, // removes bottom border on the last item
              ]}
            >
              <View style={styles.menuLeft}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Logout button — not wired to real auth logic yet */}
        <Pressable style={styles.logoutButton}>
          <Text style={styles.logoutText}>log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  header: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20, color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 }, // clears the floating tab bar
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1EFE8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E5E2D8' },
  userName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  userEmail: { fontSize: 13, color: '#5F5E5A', marginTop: 2 },
  editButton: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9D6CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  menuList: {
    backgroundColor: '#F1EFE8',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden', // ensures children respect the rounded corners
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E2D8',
  },
  menuItemLast: {
    borderBottomWidth: 0, // last item has no divider line beneath it
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 16, marginRight: 12, width: 20, textAlign: 'center' },
  menuLabel: { fontSize: 14, color: '#1A1A1A' },
  chevron: { fontSize: 18, color: '#B0AEA4' },
  logoutButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D9736A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#D9736A' },
});