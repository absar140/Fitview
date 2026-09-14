import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, AppState, AppStateStatus } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';

export default function TryOnScreen() {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const frontDevice = useCameraDevice('front');
  const backDevice = useCameraDevice('back');
  // Use front camera for try-on, fall back to back camera if front is unavailable
  const device = frontDevice ?? backDevice;

  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState ?? 'active');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Track app foreground/background state
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
    });
    return () => subscription.remove();
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const isActive = isFocused && appState === 'active';

  // Permission not yet granted
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          {!canRequestPermission
            ? 'Camera access was denied. Please enable camera permission in your device settings to use virtual try-on.'
            : 'Camera permission is required for AR try-on.'}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => (!canRequestPermission ? Linking.openSettings() : requestPermission())}
        >
          <Text style={styles.buttonText}>
            {!canRequestPermission ? 'Open Settings' : 'Grant Permission'}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Device still initializing or no camera available
  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Initializing camera device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        resizeMode="cover"
        onError={(error) => {
          console.warn('VisionCamera error:', error);
          setCameraError(error.message);
        }}
        onStarted={() => {
          setCameraError(null);
        }}
      />

      {cameraError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Camera Error: {cameraError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#C1622F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
