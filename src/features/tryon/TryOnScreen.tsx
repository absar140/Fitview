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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
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
import { mockGarments } from '../../services/mockGarments';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import ViewShot from 'react-native-view-shot';
import { usePoseTracking } from './cv/usePoseTracking';
import type { PoseShared, PoseStats } from './cv/usePoseTracking';
import { OCC_EMPTY } from './cv/usePoseTracking';
import { ArmOccluders } from './rendering/ArmOccluders';

type RouteProps = RouteProp<RootStackParamList, 'TryOn'>;

const CAMERA_Z = 3;
const FILAMENT_CAMERA_POSITION: Float3 = [0, 0, CAMERA_Z];
const HIDDEN_Z = 100; // pushes the model behind the Filament camera (= invisible)
const GLIDE_SECONDS = 0.12; // render-thread smoothing between pose updates (bigger = softer, more lag)

// ---- DEBUG (testing only; set both to false when done) ----
const DEBUG = true; // shows a status box on screen
const FORCE_SHOW_MODEL = false; // true = keep the shirt in the middle without a pose (3D-only testing)
const OCCLUSION = true; // Phase 4b: forearms/hands in front of the shirt cut through it

// NOTE: shirt3.glb was removed from this list. It REQUIRES the glTF extension EXT_texture_webp
// (WebP textures), which Filament's glTF loader cannot decode. 
// Per-garment fit (spec §6 "anchor profile"):
//   widthFraction   – how much of the model's width is the shoulder-to-shoulder part
//   shoulderFactor  – garment shoulder width relative to the body's shoulder width
//   topAboveShoulder – how far the top of the model (collar) sits ABOVE the shoulder line,
//                      in body shoulder widths (bigger = garment moves down). Default below.
const DEFAULT_TOP_ABOVE_SHOULDER = 0.22;
type GarmentFitConfig = { source: any; widthFraction: number; shoulderFactor: number; topAboveShoulder?: number };
const GLB_ASSETS: Record<string, GarmentFitConfig> = {
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

  const navigation = useNavigation();
  const viewShotRef = useRef<any>(null);

  // Plain numbers in shared values: written on the frame-processor thread (usePoseTracking),
  // consumed by the Filament render callback on the Filament thread.
  const poseX = useSharedValue(0);
  const poseY = useSharedValue(0);
  const poseS = useSharedValue(0.5); // FORCE_SHOW size before any pose (1 = fills the screen)
  const poseRoll = useSharedValue(0);
  const poseYaw = useSharedValue(0);
  const poseVisible = useSharedValue(FORCE_SHOW_MODEL ? 1 : 0);
  const pose: PoseShared = useMemo(
    () => ({ x: poseX, y: poseY, s: poseS, roll: poseRoll, yaw: poseYaw, visible: poseVisible }),
    [poseX, poseY, poseS, poseRoll, poseYaw, poseVisible]
  );

  const occluders = useSharedValue<number[]>(OCC_EMPTY);
  const [isTracking, setIsTracking] = useState(false);

  // Phase 8: capture = camera + rendered garment in ONE image (spec §16 / Definition of Done).
  // handleGLSurfaceViewOnAndroid makes view-shot PixelCopy the camera's SurfaceView; the Filament
  // TextureView on top is captured as well, in the same order as on screen.
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const handleCapture = async () => {
    if (!viewShotRef.current || capturing) return;
    setCapturing(true);
    try {
      const uri = await viewShotRef.current.capture();
      setCaptureUri(uri);
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Capture failed', String(e));
    } finally {
      setCapturing(false);
    }
  };

  const onTrackingChange = useCallback((t: boolean) => setIsTracking(t), []);
  const fit = GLB_ASSETS[selectedGarmentId] ?? GLB_ASSETS.g1;

  // Phase 3: pose + smoothing + garment maths run on the camera's frame-processor thread.
  // JS only receives "tracking started / lost".
  const tracker = usePoseTracking({
    pose,
    mirror: cameraPosition === 'front',
    fit,
    forceShow: FORCE_SHOW_MODEL,
    onTrackingChange,
    occluders: OCCLUSION ? occluders : undefined,
  });

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>No camera found on this device.</Text>
      </View>
    );
  }

  const garmentSource = GLB_ASSETS[selectedGarmentId]?.source ?? GLB_ASSETS.g1.source;

  return (
    <View style={styles.container} onLayout={tracker.onLayout}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'jpg', quality: 0.9, result: 'tmpfile', handleGLSurfaceViewOnAndroid: true }}
        style={StyleSheet.absoluteFill}
      >
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={15}
          isActive={true}
          photo={false}
          video={false}
          audio={false}
          pixelFormat="rgb" // the fitviewPose plugin needs RGBA_8888 frames
          resizeMode="cover" // usePoseTracking maps landmarks assuming "cover"
          frameProcessor={tracker.frameProcessor}
          onError={(error) => setCameraError(error.message)}
        />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <FilamentScene>
            <FilamentView style={styles.filament} enableTransparentRendering>
              <FilamentCamera cameraPosition={FILAMENT_CAMERA_POSITION} />
              <DefaultLight />
              {/* key -> a garment switch only reloads the model, the FilamentView/swapchain stays */}
              <GarmentModel key={selectedGarmentId} source={garmentSource} pose={pose} fit={fit} />
              {OCCLUSION && <ArmOccluders occluders={occluders} />}
            </FilamentView>
          </FilamentScene>
        </View>
      </ViewShot>

      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <View style={styles.topBarRight}>
          {DEBUG && (
            // Phase 3 debug: skeleton overlay from the same on-device pose plugin
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('PoseDebug' as never)}>
              <Text style={styles.debugBtnText}>POSE</Text>
            </Pressable>
          )}
          {DEBUG && (
            // Phase 4 debug: opens the segmentation (body mask) debug screen
            <Pressable style={styles.iconButton} onPress={() => navigation.navigate('SegmentationDebug' as never)}>
              <Text style={styles.debugBtnText}>MASK</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.iconButton}
            onPress={() => setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'))}
          >
            <Text style={styles.iconText}>⟳</Text>
          </Pressable>
        </View>
      </View>

      {DEBUG && <DebugBox stats={tracker.stats} pluginOk={tracker.pluginAvailable} />}

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
          <Pressable style={styles.captureButton} onPress={handleCapture} disabled={capturing}>
            {capturing && <ActivityIndicator color="#1A1A1A" style={styles.captureSpinner} />}
          </Pressable>
        </View>
      </View>

      {/* Captured result. The camera keeps running underneath (no restart). */}
      <Modal visible={captureUri != null} animationType="fade" onRequestClose={() => setCaptureUri(null)}>
        <View style={styles.previewContainer}>
          {captureUri != null && <Image source={{ uri: captureUri }} style={styles.previewImage} resizeMode="contain" />}
          <View style={styles.previewBar}>
            <Pressable style={styles.previewBtn} onPress={() => setCaptureUri(null)}>
              <Text style={styles.previewBtnText}>Retake</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
function GarmentModel({ source, pose, fit }: { source: any; pose: PoseShared; fit: GarmentFitConfig }) {
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
  const halfHeightUnit = bbox ? bbox.halfExtent[1] * unitScale : 1; // model half-height at scale 1
  const widthFraction = fit.widthFraction;
  const shoulderFactor = fit.shoulderFactor;
  const topAbove = fit.topAboveShoulder ?? DEFAULT_TOP_ABOVE_SHOULDER;

  const px = pose.x;
  const py = pose.y;
  const ps = pose.s;
  const proll = pose.roll;
  const pyaw = pose.yaw;
  const pvisible = pose.visible;
  // What is actually drawn: [initialised, x, y, scale, roll, yaw]. Pose only updates a few times a
  // second on slow phones; the render loop (60 fps) glides towards the latest pose instead of
  // jumping, so the garment moves continuously.
  const shown = useSharedValue<number[]>([0, 0, 0, 1, 0, 0]);

  RenderCallbackContext.useRenderCallback((frameInfo) => {
    'worklet';
    if (rootEntity == null) return;

    // NOTE: no array/object destructuring inside worklets (Babel turns it into helper functions
    // that the worklet runtime can't capture).
    const visible = pvisible.value > 0.5;
    const cur = shown.value;
    let dt = frameInfo.timeSinceLastFrame;
    if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
    // fraction of the remaining distance covered this frame (time constant GLIDE_SECONDS)
    const k = cur[0] < 0.5 || !visible ? 1 : 1 - Math.exp(-dt / GLIDE_SECONDS);
    const x = cur[1] + (px.value - cur[1]) * k;
    const y = cur[2] + (py.value - cur[2]) * k;
    const sc = cur[3] + (ps.value - cur[3]) * k;
    const roll = cur[4] + (proll.value - cur[4]) * k;
    const yaw = cur[5] + (pyaw.value - cur[5]) * k;
    shown.value = [visible ? 1 : 0, x, y, sc, roll, yaw];

    // (x, y) is the shoulder midpoint. Hang the garment below it: its centre is
    // d = halfHeight - topAbove × shoulderWidth further "down the body" (down = rotated by roll).
    const halfH = halfHeightUnit * sc;
    const shoulderWorld = (sc * 2 * widthFraction) / shoulderFactor; // inverse of the scale formula
    const d = halfH - topAbove * shoulderWorld;
    const centerX = x + d * Math.sin(roll);
    const centerY = y - d * Math.cos(roll);

    const s = sc * unitScale;
    const z = visible ? 0 : HIDDEN_Z;
    transformManager.setEntityPosition(rootEntity, [-cX, -cY, -cZ], false); // reset: T(-center)
    transformManager.setEntityScale(rootEntity, [s, s, s], true);
    transformManager.setEntityRotation(rootEntity, yaw, [0, 1, 0], true);
    transformManager.setEntityRotation(rootEntity, roll, [0, 0, 1], true);
    transformManager.setEntityPosition(rootEntity, [centerX, centerY, z], true);
  }, [rootEntity, transformManager, cX, cY, cZ, unitScale, halfHeightUnit, widthFraction, shoulderFactor, topAbove, px, py, ps, proll, pyaw, pvisible, shown]);

  return null;
}

/** Owns its own 500 ms timer, so the debug text no longer re-renders the whole camera/3D screen. */
function DebugBox({ stats, pluginOk }: { stats: PoseStats; pluginOk: boolean }) {
  const [text, setText] = useState('waiting for pose results...');
  const tick = useCallback(() => {
    if (!pluginOk) {
      setText('fitviewPose plugin NOT found\n(rebuild the Android app)');
      return;
    }
    setText(
      `frames analysed: ${stats.frames.value}\nwith pose: ${stats.found.value}\ninference: ${Math.round(stats.inferenceMs.value)} ms\n` +
        `shoulder vis: ${stats.shoulderVis.value.toFixed(2)} (need 0.50)\nhip vis: ${stats.hipVis.value.toFixed(2)} (optional)\n` +
        `mask: ${stats.maskMode.value > 0.5 ? 'ON' : 'OFF (pose only)'}  used: ${stats.masksUsed.value}\n` +
        `occluder L: ${stats.occLeft.value > 0.5 ? 'ON' : 'off'} (thick ${stats.occThickL.value.toFixed(2)})  ` +
        `R: ${stats.occRight.value > 0.5 ? 'ON' : 'off'} (thick ${stats.occThickR.value.toFixed(2)})` +
        (stats.lastError.value ? `\nERROR: ${stats.lastError.value}` : '')
    );
  }, [stats, pluginOk]);
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
  topBarRight: { flexDirection: 'row', gap: 10 },
  debugBtnText: { fontSize: 10, fontWeight: '700', color: '#00E676' },
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
  captureButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  captureSpinner: { position: 'absolute' },
  previewContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center' },
  previewImage: { flex: 1 },
  previewBar: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  previewBtn: { backgroundColor: '#C1622F', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  previewBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
