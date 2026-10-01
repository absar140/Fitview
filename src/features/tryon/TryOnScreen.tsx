import React, { useEffect, useRef , useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, FlatList, Image } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { usePoseDetection, RunningMode, Delegate } from 'react-native-mediapipe-posedetection';
import { useRoute, RouteProp } from '@react-navigation/native';
import { mockGarments } from '../../services/mockGarments';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';

type RouteProps = RouteProp<RootStackParamList, 'TryOn'>;

const DEBUG_LANDMARK_INDICES = [11, 12, 23, 24]; // leftShoulder, rightShoulder, leftHip, rightHip

export default function TryOnScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);
  const maxExposure = device?.maxExposure ?? 0;
     const format = useCameraFormat(device, [
  { fps: 30 },
  { photoHdr: true },
]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const route = useRoute<RouteProps>();
  const [selectedGarmentId, setSelectedGarmentId] = useState(
    route.params?.garmentId ?? mockGarments[0].id
  );

  const [debugDots, setDebugDots] = useState<{ x: number; y: number }[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const smoothedRef = useRef<{ x: number; y: number }[]>([]);
  const ALPHA = 0.35;
  const shirtImage = useImage(require('../../../assets/garments/shirt.glb'));


  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then((granted) => {
        if (!granted) setPermissionDenied(true);
      });
    }
  }, [hasPermission, requestPermission]);

  const poseDetection = usePoseDetection(
    {
      // Correct shape: result.results is an array of pose bundles (one per
      // frame-processing call), each containing .landmarks (per detected person).
      // The second argument `vc` (ViewCoordinator) correctly converts normalized
      // landmark coordinates into actual on-screen pixel positions, accounting
      // for camera rotation/resize — more reliable than manual math.
      onResults: (result, vc) => {
        const poseResult = result.results[0];
        if (poseResult && poseResult.landmarks.length > 0) {
          setIsTracking(true);
          const frameDims = vc.getFrameDims(result);
          const points = DEBUG_LANDMARK_INDICES.map((index) => {
  const landmark = poseResult.landmarks[0][index];
  return vc.convertPoint(frameDims, { x: landmark.x, y: landmark.y });
});

const smoothed = points.map((p, i) => {
  const prev = smoothedRef.current[i] ?? p;
  return {
    x: prev.x + ALPHA * (p.x - prev.x),
    y: prev.y + ALPHA * (p.y - prev.y),
  };
});
smoothedRef.current = smoothed;
setDebugDots(smoothed);
        } else {
          setIsTracking(false);
        }
      },
      onError: (error) => {
        console.log('Pose detection error:', error.message);
      },
    },
    RunningMode.LIVE_STREAM,
    'pose_landmarker_lite.task',
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.GPU,
    }
  );

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          {permissionDenied
            ? 'Camera access was denied. Please enable it manually in your phone settings.'
            : 'Camera permission is needed for try-on.'}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => (permissionDenied ? Linking.openSettings() : requestPermission())}
        >
          <Text style={styles.buttonText}>{permissionDenied ? 'open settings' : 'grant permission'}</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>No camera found on this device.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
     <Camera
  style={StyleSheet.absoluteFill}
  device={device}
    exposure={maxExposure} 
   format={format}
  fps={30}
  isActive={true}
  video={true}
  audio={false}
  pixelFormat="rgb"
  resizeMode="cover"
   torch="on"
  lowLightBoost={device.supportsLowLightBoost}
  frameProcessor={poseDetection.frameProcessor}
  onLayout={poseDetection.cameraViewLayoutChangeHandler}
  onError={(error) => setCameraError(error.message)}
/>
   <Canvas style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
  {shirtImage && debugDots.length >= 2 && (() => {

    const leftShoulder = debugDots[0]; // Index 11
    const rightShoulder = debugDots[1]; // Index 12
    const dx = rightShoulder.x - leftShoulder.x;
    const dy = rightShoulder.y - leftShoulder.y;
    const shoulderDistance = Math.sqrt(dx * dx + dy * dy);

    const shirtWidth = shoulderDistance * 1.6;
    const shirtHeight = shirtWidth * 1.2; 

    const centerX = (leftShoulder.x + rightShoulder.x) / 2 - (shirtWidth / 2);
    const centerY = ((leftShoulder.y + rightShoulder.y) / 2) - (shirtHeight / 4); 

    return (
      <SkiaImage
        image={shirtImage}
        x={centerX}
        y={centerY}
        width={shirtWidth}
        height={shirtHeight}
      />
    );
  })()}
</Canvas>

      {debugDots.map((point, index) => (
        <View key={index} style={[styles.debugDot, { left: point.x - 8, top: point.y - 8 }]} />
      ))}

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'))}
        >
          <Text style={styles.iconText}>⟳</Text>
        </Pressable>
      </View>

      {!isTracking && (
        <View style={styles.trackingPill}>
          <Text style={styles.trackingPillText}>move into frame</Text>
        </View>
      )}

      {cameraError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{cameraError}</Text>
        </View>
      )}

      <View style={styles.bottomArea}>
        <FlatList
          data={mockGarments}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedGarmentId(item.id)}
              style={[
                styles.thumbnailWrapper,
                item.id === selectedGarmentId && styles.thumbnailWrapperSelected,
              ]}
            >
              <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            </Pressable>
          )}
        />
        <View style={styles.captureRow}>
          <Pressable style={styles.captureButton} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#C1622F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  debugDot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#00FF00', borderWidth: 2, borderColor: '#FFFFFF' },
  topBar: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#FFFFFF' },
  trackingPill: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  trackingPillText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  errorOverlay: { position: 'absolute', bottom: 180, left: 20, right: 20, backgroundColor: 'rgba(255,0,0,0.85)', padding: 12, borderRadius: 8 },
  errorText: { color: '#FFFFFF', fontSize: 12 },
  bottomArea: { position: 'absolute', bottom: 90, left: 0, right: 0, paddingBottom: 10 },
  carousel: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  thumbnailWrapper: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbnailWrapperSelected: { borderColor: '#C1622F' },
  thumbnail: { width: '100%', height: '100%' },
  captureRow: { alignItems: 'center' },
  captureButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
});