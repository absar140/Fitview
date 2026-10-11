import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  FlatList,
  Image,
  Alert,
  AppState,
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
  Camera as FilamentCamera,
  DefaultLight,
  RenderCallbackContext,
  useFilamentContext,
  useModel,
} from 'react-native-filament';
import type { Float3 } from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import type { ISharedValue } from 'react-native-worklets-core';
import { mockGarments } from '../../services/mockGarments';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import ViewShot from 'react-native-view-shot';

type RouteProps = RouteProp<RootStackParamList, 'TryOn'>;
type PoseCallbacks = Parameters<typeof usePoseDetection>[0];
type PoseOptions = Parameters<typeof usePoseDetection>[3];

const CAMERA_Z = 3;
const FILAMENT_CAMERA_POSITION: Float3 = [0, 0, CAMERA_Z];
const VERTICAL_FOV_DEG = 45;
const TORSO_ANCHOR = 0.45;
const UNIT_CUBE_SIZE = 2;
const FLIP_X = false;
const ROLL_SIGN = -1;
const YAW_GAIN = 0;
const ALPHA = 0.35;
const MAX_MISSED_FRAMES = 5;
const HIDDEN_Z = 100; // pushes the model behind the Filament camera (= invisible)

// ---- DEBUG (testing only; set both to false when done) ----
const DEBUG = true; // shows a status box on screen
const FORCE_SHOW_MODEL = true; // shows the shirt in the middle even without pose, to test 3D alone
const USE_GPU_DELEGATE = false; // GPU delegate fails on many phones; CPU is safer

const VISIBLE_HEIGHT_AT_ORIGIN = 2 * CAMERA_Z * Math.tan((VERTICAL_FOV_DEG * Math.PI) / 360);

// NOTE: shirt3.glb was removed from this list. It REQUIRES the glTF extension EXT_texture_webp
// (WebP textures), which Filament's glTF loader cannot decode. 
const GLB_ASSETS: Record<string, { source: any; widthFraction: number; shoulderFactor: number }> = {
  g1: { source: require('../../../assets/garments/shirt1.glb'), widthFraction: 0.89, shoulderFactor: 1.5 },
  g2: { source: require('../../../assets/garments/shirt2.glb'), widthFraction: 1.0, shoulderFactor: 1.5 },
  // g3: { source: require('../../../assets/garments/shirt3.glb'), widthFraction: 1.0, shoulderFactor: 1.5 },
  g4: { source: require('../../../assets/garments/shirt4.glb'), widthFraction: 0.84, shoulderFactor: 1.5 },
  g5: { source: require('../../../assets/garments/shirt5.glb'), widthFraction: 0.98, shoulderFactor: 1.5 },
  g6: { source: require('../../../assets/garments/shirt6.glb'), widthFraction: 0.95, shoulderFactor: 1.5 },
  g7: { source: require('../../../assets/garments/shirt7.glb'), widthFraction: 0.98, shoulderFactor: 1.5 },
  g8: { source: require('../../../assets/garments/shirt8.glb'), widthFraction: 1.0, shoulderFactor: 2.5 },
  g9: { source: require('../../../assets/garments/shirt9.glb'), widthFraction: 1.0, shoulderFactor: 2.5 },
  g10: { source: require('../../../assets/garments/shirt10.glb'), widthFraction: 1.0, shoulderFactor: 1.5 },
};
const TRYON_GARMENTS = mockGarments.filter((g) => GLB_ASSETS[g.id]);

// Module-level constant -> same object every render, so usePoseDetection doesn't rebuild things.
const POSE_OPTIONS: PoseOptions = {
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  delegate: Platform.OS === 'android' && USE_GPU_DELEGATE ? Delegate.GPU : Delegate.CPU,
  fpsMode: 15,
};

/** Pose -> 3D bridge. Written on the JS thread (pose results), read on the Filament render thread. */
type PoseShared = {
  x: ISharedValue<number>;
  y: ISharedValue<number>;
  s: ISharedValue<number>;
  roll: ISharedValue<number>;
  yaw: ISharedValue<number>;
  visible: ISharedValue<number>; // 1 = show, 0 = hide
};

function useAppIsActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export default function TryOnScreen() {
  const isFocused = useIsFocused();
  const appActive = useAppIsActive();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const route = useRoute<RouteProps>();

  useEffect(() => {
    if (isFocused && !hasPermission) {
      requestPermission().then((granted) => {
        if (!granted) setPermissionDenied(true);
      });
    }
  }, [isFocused, hasPermission, requestPermission]);

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

  if (!isFocused || !appActive) {
    return <View style={styles.container} />;
  }

  const requested = route.params?.garmentId;
  const initialGarmentId = requested && GLB_ASSETS[requested] ? requested : TRYON_GARMENTS[0]?.id ?? 'g1';
  return <TryOnSession initialGarmentId={initialGarmentId} />;
}

function TryOnSession({ initialGarmentId }: { initialGarmentId: string }) {
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }, { fps: 30 }]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [selectedGarmentId, setSelectedGarmentId] = useState<string>(initialGarmentId);
  const selectedGarmentIdRef = useRef(selectedGarmentId);
  selectedGarmentIdRef.current = selectedGarmentId;

  const navigation = useNavigation();
  const viewShotRef = useRef<any>(null);

  const window = useWindowDimensions();
  const viewSize = useRef({ w: window.width, h: window.height });
  const onContainerLayout = (e: LayoutChangeEvent) => {
    viewSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  // Plain numbers in shared values (no arrays): written here on the JS thread, consumed by the
  // Filament render callback on the Filament thread.
  const poseX = useSharedValue(0);
  const poseY = useSharedValue(0);
  const poseS = useSharedValue(1);
  const poseRoll = useSharedValue(0);
  const poseYaw = useSharedValue(0);
  const poseVisible = useSharedValue(FORCE_SHOW_MODEL ? 1 : 0);
  const pose: PoseShared = useMemo(
    () => ({ x: poseX, y: poseY, s: poseS, roll: poseRoll, yaw: poseYaw, visible: poseVisible }),
    [poseX, poseY, poseS, poseRoll, poseYaw, poseVisible]
  );

  const dbgRef = useRef({ results: 0, withPose: 0, lmCount: 0, err: '' });
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

  const onResultsImpl: PoseCallbacks['onResults'] = (result, vc) => {
    dbgRef.current.results += 1;
    const lm = result.results[0]?.landmarks?.[0];

    if (lm) {
      dbgRef.current.withPose += 1;
      dbgRef.current.lmCount = lm.length;
    }
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
        const t = a;
        a = b;
        b = t;
        const tz = az;
        az = bz;
        bz = tz;
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
      // Size relative to the unit cube (the 2/maxExtent normalisation is applied in GarmentModel).
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

      poseX.value = st.x;
      poseY.value = st.y;
      poseS.value = st.s;
      poseRoll.value = st.roll;
      poseYaw.value = st.yaw;
      poseVisible.value = 1;
    } else {
      missedFrames.current += 1;
      if (missedFrames.current > MAX_MISSED_FRAMES) {
        if (!FORCE_SHOW_MODEL) poseVisible.value = 0;
        smoothed.current.init = false;
        if (trackingRef.current) {
          trackingRef.current = false;
          setIsTracking(false);
        }
      }
    }
  };

  const onErrorImpl: PoseCallbacks['onError'] = (error) => {
    console.log('Pose detection error:', error.message);
    dbgRef.current.err = String(error.message).slice(0, 120);
  };

  // Keep the callbacks we hand to usePoseDetection referentially STABLE. Before, a new onResults
  // on every render rebuilt the library's detector map + frame processor on every re-render
  // (the debug box re-rendered every 500 ms), constantly re-installing the camera frame processor.
  const handlersRef = useRef({ onResults: onResultsImpl, onError: onErrorImpl });
  handlersRef.current = { onResults: onResultsImpl, onError: onErrorImpl };
  const poseCallbacks = useMemo<PoseCallbacks>(
    () => ({
      onResults: (r, vc) => handlersRef.current.onResults(r, vc),
      onError: (e) => handlersRef.current.onError(e),
    }),
    []
  );

  const poseDetection = usePoseDetection(poseCallbacks, RunningMode.LIVE_STREAM, 'pose_landmarker_lite.task', POSE_OPTIONS);

  // The library needs to know which camera is used, otherwise the front camera is NOT treated as
  // mirrored and the X coordinates of the landmarks come out flipped. (MediapipeCamera does this
  // internally; we use the raw VisionCamera <Camera>, so we must do it ourselves.)
  const deviceChangeRef = useRef(poseDetection.cameraDeviceChangeHandler);
  deviceChangeRef.current = poseDetection.cameraDeviceChangeHandler;
  useEffect(() => {
    if (device) deviceChangeRef.current(device);
    smoothed.current.init = false;
  }, [device]);

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>No camera found on this device.</Text>
      </View>
    );
  }

  const garmentSource = GLB_ASSETS[selectedGarmentId]?.source ?? GLB_ASSETS.g1.source;

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={StyleSheet.absoluteFill}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={15}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          pixelFormat="rgb" // MediaPipe needs RGBA_8888 frames on Android
          resizeMode="cover"
          frameProcessor={poseDetection.frameProcessor}
          onLayout={poseDetection.cameraViewLayoutChangeHandler}
          onOutputOrientationChanged={poseDetection.cameraOrientationChangedHandler}
          onError={(error) => setCameraError(error.message)}
        />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <FilamentScene>
            <FilamentView style={styles.filament} enableTransparentRendering>
              <FilamentCamera cameraPosition={FILAMENT_CAMERA_POSITION} />
              <DefaultLight />
              {/* key -> a garment switch only reloads the model, the FilamentView/swapchain stays */}
              <GarmentModel key={selectedGarmentId} source={garmentSource} pose={pose} />
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

      {DEBUG && <DebugBox dbgRef={dbgRef} />}

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
              style={[styles.thumbnailWrapper, item.id === selectedGarmentId && styles.thumbnailWrapperSelected]}
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

/**
 * Loads one garment and positions it from the pose shared values INSIDE the Filament render
 * callback (Filament thread, right before each frame is drawn).
 *
 * Why not <Model translate={sv} scale={sv} rotate={sv} />?
 *  - Those props default to multiplyWithCurrentTransform = true, and the native side does
 *    newTransform = transform * currentTransform on EVERY update. With pose updates at ~15 fps the
 *    scale/translation/rotation compounded every frame, so the shirt shot off-screen / became
 *    huge or microscopic within a second -> "the 3D garment is not rendered".
 *  - Their listeners ran on whatever thread wrote the shared value (the JS thread here), so the
 *    Filament transforms were changed from the JS thread while the render thread was drawing.
 * Here we rebuild the full transform from scratch every frame: T(pos) * Rz * Ry * S * T(-center).
 */
function GarmentModel({ source, pose }: { source: any; pose: PoseShared }) {
  const { transformManager } = useFilamentContext();
  const model = useModel(source);

  const rootEntity = model.state === 'loaded' ? model.rootEntity : undefined;
  const bbox = model.state === 'loaded' ? model.boundingBox : undefined;

  // Same normalisation as transformToUnitCube: centre the model and fit its largest side into 2 units.
  const cX = bbox ? bbox.center[0] : 0;
  const cY = bbox ? bbox.center[1] : 0;
  const cZ = bbox ? bbox.center[2] : 0;
  const maxHalf = bbox ? Math.max(bbox.halfExtent[0], bbox.halfExtent[1], bbox.halfExtent[2]) : 1;
  const unitScale = maxHalf > 0 ? 1 / maxHalf : 1;

  const px = pose.x;
  const py = pose.y;
  const ps = pose.s;
  const proll = pose.roll;
  const pyaw = pose.yaw;
  const pvisible = pose.visible;

  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (rootEntity == null) return;

    // NOTE: no array/object destructuring inside worklets (Babel turns it into helper functions
    // that the worklet runtime can't capture).
    const s = ps.value * unitScale;
    const z = pvisible.value > 0.5 ? 0 : HIDDEN_Z;

    transformManager.setEntityPosition(rootEntity, [-cX, -cY, -cZ], false); // reset: T(-center)
    transformManager.setEntityScale(rootEntity, [s, s, s], true);
    transformManager.setEntityRotation(rootEntity, pyaw.value, [0, 1, 0], true);
    transformManager.setEntityRotation(rootEntity, proll.value, [0, 0, 1], true);
    transformManager.setEntityPosition(rootEntity, [px.value, py.value, z], true);
  }, [rootEntity, transformManager, cX, cY, cZ, unitScale, px, py, ps, proll, pyaw, pvisible]);

  return null;
}

/** Owns its own 500 ms timer, so the debug text no longer re-renders the whole camera/3D screen. */
function DebugBox({ dbgRef }: { dbgRef: React.MutableRefObject<{ results: number; withPose: number; lmCount: number; err: string }> }) {
  const [text, setText] = useState('waiting for pose results...');
  const tick = useCallback(() => {
    const d = dbgRef.current;
    setText(`results: ${d.results}\nwith pose: ${d.withPose}\nlandmarks: ${d.lmCount}\nerr: ${d.err || '-'}`);
  }, [dbgRef]);
  useEffect(() => {
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [tick]);
  return (
    <View style={styles.debugBox} pointerEvents="none">
      <Text style={styles.debugText}>{text}</Text>
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
  debugBox: { position: 'absolute', top: 100, left: 12, backgroundColor: 'rgba(0,0,0,0.65)', padding: 8, borderRadius: 8 },
  debugText: { color: '#0f0', fontSize: 12 },
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
