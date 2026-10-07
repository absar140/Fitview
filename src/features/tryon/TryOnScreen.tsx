import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  FlatList,
  Image,
  Alert,
  useWindowDimensions,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { usePoseDetection, RunningMode, Delegate } from 'react-native-mediapipe-posedetection';
import { useRoute, RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import {
  FilamentScene,
  FilamentView,
  Model,
  Camera as FilamentCamera,
  DefaultLight,
} from 'react-native-filament';
import type { Float3 } from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { mockGarments } from '../../services/mockGarments';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import ViewShot from 'react-native-view-shot';

type RouteProps = RouteProp<RootStackParamList, 'TryOn'>;

const CAMERA_Z = 3;
const VERTICAL_FOV_DEG = 45;
const TORSO_ANCHOR = 0.45;
const UNIT_CUBE_SIZE = 2;
const MODEL_BASE_ROTATION: Float3 = [0, 0, 0];
const FLIP_X = false;
const ROLL_SIGN = -1;
const YAW_GAIN = 0;
const ALPHA = 0.35;
const MAX_MISSED_FRAMES = 5;
const HIDDEN_TRANSLATE: Float3 = [0, 0, 100];

const VISIBLE_HEIGHT_AT_ORIGIN = 2 * CAMERA_Z * Math.tan((VERTICAL_FOV_DEG * Math.PI) / 360);

const GLB_ASSETS: Record<string, { source: any; widthFraction: number; shoulderFactor: number }> = {
  'g1': { source: require('../../../assets/garments/shirt1.glb'), widthFraction: 0.89, shoulderFactor: 1.5 },
  'g2': { source: require('../../../assets/garments/shirt2.glb'), widthFraction: 1.0, shoulderFactor: 1.5 },
  'g3': { source: require('../../../assets/garments/shirt3.glb'), widthFraction: 1.0, shoulderFactor: 1.5 },
  'g4': { source: require('../../../assets/garments/shirt4.glb'), widthFraction: 0.84, shoulderFactor: 1.5 },
  'g5': { source: require('../../../assets/garments/shirt5.glb'), widthFraction: 0.98, shoulderFactor: 1.5 },
  'g6': { source: require('../../../assets/garments/shirt6.glb'), widthFraction: 0.95, shoulderFactor: 1.5 },
  'g7': { source: require('../../../assets/garments/shirt7.glb'), widthFraction: 0.98, shoulderFactor: 1.5 },
  'g8': { source: require('../../../assets/garments/shirt8.glb'), widthFraction: 1.0, shoulderFactor: 2.5 }, 
  'g9': { source: require('../../../assets/garments/shirt9.glb'), widthFraction: 1.0, shoulderFactor: 2.5 }, 
  'g10': { source: require('../../../assets/garments/shirt10.glb'), widthFraction: 1.0, shoulderFactor: 1.5 }
};
const TRYON_GARMENTS = mockGarments.filter((g) => GLB_ASSETS[g.id]);

export default function TryOnScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);
  
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 30 },
  ]);
  const isFocused = useIsFocused();

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const route = useRoute<RouteProps>();
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>(
    route.params?.garmentId ?? TRYON_GARMENTS[0]?.id ?? 'g1'
  );

  const selectedGarmentIdRef = useRef(selectedGarmentId);
  selectedGarmentIdRef.current = selectedGarmentId;

  const navigation = useNavigation();
  const cameraRef = useRef<Camera>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const window = useWindowDimensions();
  const viewSize = useRef({ w: window.width, h: window.height });
  const onContainerLayout = (e: LayoutChangeEvent) => {
    viewSize.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const translate = useSharedValue<Float3>(HIDDEN_TRANSLATE);
  const scale = useSharedValue<Float3>([1, 1, 1]);
  const rotate = useSharedValue<Float3>(MODEL_BASE_ROTATION);

  const smoothed = useRef({ init: false, x: 0, y: 0, s: 1, roll: 0, yaw: 0 });
  const missedFrames = useRef(0);
  const trackingRef = useRef(false);
  const [isTracking, setIsTracking] = useState(false);

  const handleCapture = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await viewShotRef.current.capture();
      console.log('Image created:', uri);
      Alert.alert('Photo Saved', uri);
    } catch (e) {
      console.error('Capture error:', e);
    }
  };

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then((granted) => {
        if (!granted) setPermissionDenied(true);
      });
    }
  }, [hasPermission, requestPermission]);

  const poseDetection = usePoseDetection(
    {
      onResults: (result, vc) => {
        const poseResult = result.results[0];
        const lm = poseResult?.landmarks?.[0];

        if (lm && lm.length > 24) {
          missedFrames.current = 0;
          if (!trackingRef.current) {
            trackingRef.current = true;
            setIsTracking(true);
          }

          const frameDims = vc.getFrameDims(result);
          const ls = lm[11];
          const rs = lm[12];
          const lh = lm[23];
          const rh = lm[24];

          let a = vc.convertPoint(frameDims, { x: ls.x, y: ls.y });
          let b = vc.convertPoint(frameDims, { x: rs.x, y: rs.y });
          let az = ls.z;
          let bz = rs.z;
          const lhPt = vc.convertPoint(frameDims, { x: lh.x, y: lh.y });
          const rhPt = vc.convertPoint(frameDims, { x: rh.x, y: rh.y });

          if (a.x > b.x) {
            [a, b] = [b, a];
            [az, bz] = [bz, az];
          }

          const { w, h } = viewSize.current;
          const worldPerPx = VISIBLE_HEIGHT_AT_ORIGIN / h;

          const shoulderMidX = (a.x + b.x) / 2;
          const shoulderMidY = (a.y + b.y) / 2;
          const hipMidX = (lhPt.x + rhPt.x) / 2;
          const hipMidY = (lhPt.y + rhPt.y) / 2;
          let cx = shoulderMidX + (hipMidX - shoulderMidX) * TORSO_ANCHOR;
          const cy = shoulderMidY + (hipMidY - shoulderMidY) * TORSO_ANCHOR;
          if (FLIP_X) cx = w - cx;

          const targetX = (cx - w / 2) * worldPerPx;
          const targetY = -(cy - h / 2) * worldPerPx;

          const shoulderPx = Math.hypot(b.x - a.x, b.y - a.y);
          const fit = GLB_ASSETS[selectedGarmentIdRef.current] ?? GLB_ASSETS.g1;
          const targetS = (shoulderPx * fit.shoulderFactor * worldPerPx) / (UNIT_CUBE_SIZE * fit.widthFraction);
          let roll = Math.atan2(b.y - a.y, b.x - a.x);
          if (FLIP_X) roll = -roll;
          const targetRoll = ROLL_SIGN * roll;

          const dxNorm = Math.max(Math.abs(rs.x - ls.x), 1e-6);
          const targetYaw = YAW_GAIN * Math.atan2(bz - az, dxNorm);

          const st = smoothed.current;
          if (!st.init) {
            st.x = targetX;
            st.y = targetY;
            st.s = targetS;
            st.roll = targetRoll;
            st.yaw = targetYaw;
            st.init = true;
          } else {
            st.x += ALPHA * (targetX - st.x);
            st.y += ALPHA * (targetY - st.y);
            st.s += ALPHA * (targetS - st.s);
            st.roll += ALPHA * (targetRoll - st.roll);
            st.yaw += ALPHA * (targetYaw - st.yaw);
          }

          translate.value = [st.x, st.y, 0];
          scale.value = [st.s, st.s, st.s];
          rotate.value = [
            MODEL_BASE_ROTATION[0],
            MODEL_BASE_ROTATION[1] + st.yaw,
            MODEL_BASE_ROTATION[2] + st.roll,
          ];
        } else {
          missedFrames.current += 1;
          if (missedFrames.current > MAX_MISSED_FRAMES) {
            translate.value = HIDDEN_TRANSLATE;
            smoothed.current.init = false;
            if (trackingRef.current) {
              trackingRef.current = false;
              setIsTracking(false);
            }
          }
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
      delegate: Platform.OS === 'android' ? Delegate.GPU : Delegate.CPU,
      fpsMode: 15,
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
    <View style={styles.container} onLayout={onContainerLayout}>
      <ViewShot 
        ref={viewShotRef} 
        options={{ format: 'jpg', quality: 0.9 }} 
        style={StyleSheet.absoluteFill}
      >
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={15}
          isActive={isFocused}
          photo={false}       
          video={false}
          audio={false}
          pixelFormat="yuv"   
          resizeMode="cover"
          lowLightBoost={device.supportsLowLightBoost}
          frameProcessor={poseDetection.frameProcessor}
          onLayout={poseDetection.cameraViewLayoutChangeHandler}
          onError={(error) => setCameraError(error.message)}
        />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <FilamentScene>
            <FilamentView style={styles.filament}>
              <FilamentCamera cameraPosition={[0, 0, CAMERA_Z]} />
              <DefaultLight />
              <Model 
                key={selectedGarmentId}
                source={GLB_ASSETS[selectedGarmentId]?.source ?? require('../../../assets/garments/shirt1.glb')} 
                transformToUnitCube
                translate={translate}
                scale={scale}
                rotate={rotate}
              />
            </FilamentView>
          </FilamentScene>
        </View>
      </ViewShot>

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
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
          data={TRYON_GARMENTS}
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
          <Pressable style={styles.captureButton} onPress={handleCapture} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  filament: { flex: 1 },
  centered: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#C1622F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
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