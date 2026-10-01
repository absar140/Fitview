import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../store/AuthContext';


type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, isLoggedIn, login, signup, logout } = useAuth();

  // Local form state for the inline login/signup form shown when logged out
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!email || !password || (isSignup && !name)) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }

    if (isSignup) {
      const success = signup(name, email, password);
      if (!success) Alert.alert('Account exists', 'That email is already registered. Try logging in instead.');
    } else {
      const success = login(email, password);
      if (!success) Alert.alert('Login failed', 'Incorrect email or password.');
    }
  };

  // --- LOGGED OUT STATE: show an inline login/signup form ---
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>profile</Text>

        <View style={styles.authBox}>
          <Text style={styles.authTitle}>{isSignup ? 'create an account' : 'log in to your account'}</Text>
          <Text style={styles.authSubtitle}>
            {isSignup
              ? 'sign up to track orders and save your details'
              : 'log in to view your orders and saved details'}
          </Text>

          {isSignup && (
            <TextInput
              style={styles.input}
              placeholder="full name"
              placeholderTextColor="#8A8778"
              value={name}
              onChangeText={setName}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor="#8A8778"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            placeholderTextColor="#8A8778"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>{isSignup ? 'sign up' : 'log in'}</Text>
          </Pressable>

          <Pressable onPress={() => setIsSignup(!isSignup)}>
            <Text style={styles.switchText}>
              {isSignup ? 'already have an account? log in' : "don't have an account? sign up"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- LOGGED IN STATE: show real profile info ---
  return (
    <View style={styles.container}>
      <Text style={styles.header}>profile</Text>
```.

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('TrackOrder')}>
          <Text style={styles.menuLabel}>track order</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56 },
  header: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20, color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 20, alignItems: 'center', paddingBottom: 120 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1EFE8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#8A8778' },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  email: { fontSize: 13, color: '#8A8778', marginTop: 2, marginBottom: 24 },
  menuItem: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F1EFE8', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  menuLabel: { fontSize: 14, color: '#1A1A1A' },
  chevron: { fontSize: 18, color: '#B0AEA4' },
  logoutButton: {
    width: '100%', height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#D9736A',
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#D9736A' },
  // Auth form styles (logged-out state)
  authBox: { paddingHorizontal: 24, paddingTop: 20 },
  authTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  authSubtitle: { fontSize: 13, color: '#8A8778', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#F1EFE8', borderRadius: 14, height: 48, paddingHorizontal: 16,
    fontSize: 14, color: '#1A1A1A', marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1A1A1A', height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  switchText: { textAlign: 'center', fontSize: 13, color: '#C1622F' },
});