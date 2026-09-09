import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../store/AuthContext';

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false); // toggles between Login and Sign Up modes
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    // Basic validation before attempting login/signup
    if (!email || !password || (isSignup && !name)) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }

    if (isSignup) {
      const success = signup(name, email, password);
      if (!success) {
        Alert.alert('Account exists', 'That email is already registered. Try logging in instead.');
      }
      // No need to navigate manually — once signup() sets the user,
      // isLoggedIn becomes true, and RootNavigator automatically
      // switches from the Login screen to the main app.
    } else {
      const success = login(email, password);
      if (!success) {
        Alert.alert('Login failed', 'Incorrect email or password.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>fitview</Text>
      <Text style={styles.subtitle}>{isSignup ? 'create your account' : 'welcome back'}</Text>

      {/* Name field only shows in Sign Up mode */}
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

      {/* Toggles between Login and Sign Up mode without navigating away */}
      <Pressable onPress={() => setIsSignup(!isSignup)}>
        <Text style={styles.switchText}>
          {isSignup ? 'already have an account? log in' : "don't have an account? sign up"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 28 },
  brand: { fontSize: 26, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8A8778', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#F1EFE8',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1A1A1A',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  switchText: { textAlign: 'center', fontSize: 13, color: '#C1622F' },
});