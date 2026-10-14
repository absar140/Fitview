/**
 * Phase 3 deliverable: "Pose debug screen" (spec §19 Phase 3 / §23).
 *
 * Uses the same on-device path as the try-on (fitviewPose native plugin, synchronous MediaPipe in
 * the frame-processor worklet). The skeleton is drawn with react-native-svg.
 *
 * Debug-only data path: the worklet converts landmarks to view pixels and sends ONE small array to
 * JS ~8 times a second. The real try-on never sends landmarks to JS.
 *
 *   green  = visibility >= 0.5 (used for tracking)
 *   grey   = low visibility (ignored)
 *   yellow = anchor the garment hangs from (shoulder midpoint)
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Line } from 'react-native-svg';
import { getPosePlugin } from './cv/posePlugins';

const DEBUG_FPS = 8;
const MIN_VISIBILITY = 0.5;
const STRIDE = 5; // plugin layout per landmark: x, y, z, visibility, presence
const POINTS = 33;

// MediaPipe pose landmarks drawn by this screen
const NAMES: Record<number, string> = {
  0: 'nose',
  11: 'L shoulder', 12: 'R shoulder',
  13: 'L elbow', 14: 'R elbow',
  15: 'L wrist', 16: 'R wrist',
  19: 'L index', 20: 'R index',
  23: 'L hip', 24: 'R hip',
  25: 'L knee', 26: 'R knee',
  27: 'L ankle', 28: 'R ankle',
  29: 'L heel', 30: 'R heel',
  31: 'L foot', 32: 'R foot',
};
const IDS = Object.keys(NAMES).map(Number);
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [15, 19], [12, 14], [14, 16], [16, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];


/** Normalised point in the upright image -> view pixels for resizeMode="cover" (same as usePoseTracking). */
function toView(nx: number, ny: number, imgW: number, imgH: number, viewW: number, viewH: number): number[] {
  'worklet';
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const offX = (viewW - imgW * scale) / 2;
  const offY = (viewH - imgH * scale) / 2;
  return [nx * imgW * scale + offX, ny * imgH * scale + offY];
}

/** pts = [x, y, visibility] × 33 in view pixels, or null when no person */
type DebugPose = { pts: number[]; inferenceMs: number } | null;

export default function PoseDebugScreen() {
  const navigation = useNavigation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(position);
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }, { fps: 30 }]);

  const viewW = useSharedValue(1);
  const viewH = useSharedValue(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      const h = e.nativeEvent.layout.height;
      viewW.value = w;
      viewH.value = h;
      setSize({ w, h });
    },
    [viewW, viewH]
  );

  const [pose, setPose] = useState<DebugPose>(null);
  const [updates, setUpdates] = useState(0);
  const onPose = useCallback((p: DebugPose) => {
    setPose(p);
    setUpdates((n) => n + 1);
  }, []);
  const sendPose = useRunOnJS(onPose, [onPose]);

  const mirror = position === 'front';
  const plugin = useMemo(() => getPosePlugin(), []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (plugin == null) return;
      runAtTargetFps(DEBUG_FPS, () => {
        'worklet';
        const r = plugin.call(frame, { mirror: mirror }) as any;
        if (r == null || r.landmarks == null) {
          // null = no person; an object without landmarks = native error (shown on the Try-On debug box)
          sendPose(null);
          return;
        }
        const lm = r.landmarks as number[];
        const iw = r.width as number;
        const ih = r.height as number;
        const out: number[] = [];
        for (let i = 0; i < POINTS; i++) {
          const p = toView(lm[i * STRIDE], lm[i * STRIDE + 1], iw, ih, viewW.value, viewH.value);
          out.push(p[0], p[1], lm[i * STRIDE + 3]);
        }
        sendPose({ pts: out, inferenceMs: r.inferenceMs as number });
      });
    },
    [plugin, mirror, sendPose, viewW, viewH]
  );

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>grant camera permission</Text>
        </Pressable>
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.btnText}>No camera found</Text>
      </View>
    );
  }

  const pt = (i: number) => (pose ? { x: pose.pts[i * 3], y: pose.pts[i * 3 + 1], v: pose.pts[i * 3 + 2] } : null);
  const ls = pt(11);
  const rs = pt(12);
  const shouldersOk = ls != null && rs != null && ls.v >= MIN_VISIBILITY && rs.v >= MIN_VISIBILITY;
  const visibleCount = pose ? IDS.filter((i) => pose.pts[i * 3 + 2] >= MIN_VISIBILITY).length : 0;
  const shoulderPx = shouldersOk && ls && rs ? Math.hypot(rs.x - ls.x, rs.y - ls.y) : 0;
  const rollDeg = shouldersOk && ls && rs ? (Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180) / Math.PI : 0;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={15}
        isActive
        photo={false}
        video={false}
        audio={false}
        pixelFormat="rgb"
        resizeMode="cover"
        frameProcessor={frameProcessor}
      />

      {pose != null && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
          {BONES.map(([i, j]) => {
            const a = pt(i);
            const b = pt(j);
            if (!a || !b) return null;
            const ok = a.v >= MIN_VISIBILITY && b.v >= MIN_VISIBILITY;
            return (
              <Line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ok ? '#00E676' : '#777777'} strokeWidth={3} />
            );
          })}
          {IDS.map((i) => {
            const p = pt(i);
            if (!p) return null;
            return <Circle key={i} cx={p.x} cy={p.y} r={5} fill={p.v >= MIN_VISIBILITY ? '#00E676' : '#777777'} />;
          })}
          {shouldersOk && ls && rs && (
            <Circle cx={(ls.x + rs.x) / 2} cy={(ls.y + rs.y) / 2} r={8} fill="none" stroke="#FFD600" strokeWidth={3} />
          )}
        </Svg>
      )}

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTitle}>POSE DEBUG</Text>
        {plugin == null ? (
          <Text style={[styles.hudText, styles.bad]}>fitviewPose plugin NOT found (rebuild Android)</Text>
        ) : (
          <>
            <Text style={[styles.hudText, shouldersOk ? styles.good : styles.bad]}>
              {shouldersOk ? 'TRACKING' : 'LOST - move into frame'}
            </Text>
            <Text style={styles.hudText}>inference: {pose ? Math.round(pose.inferenceMs) : '-'} ms</Text>
            <Text style={styles.hudText}>visible landmarks: {visibleCount}/{IDS.length}</Text>
            <Text style={styles.hudText}>shoulder width: {shoulderPx.toFixed(0)} px</Text>
            <Text style={styles.hudText}>shoulder roll: {rollDeg.toFixed(1)}°</Text>
            <Text style={styles.hudText}>updates: {updates}</Text>
          </>
        )}
      </View>

      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => setPosition((p) => (p === 'front' ? 'back' : 'front'))}>
          <Text style={styles.iconText}>⟳</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  btn: { backgroundColor: '#C1622F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  topBar: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#fff' },
  hud: { position: 'absolute', top: 100, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 },
  hudTitle: { color: '#FFD600', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  hudText: { color: '#fff', fontSize: 12, marginBottom: 2 },
  good: { color: '#00E676', fontWeight: '700' },
  bad: { color: '#FF5252', fontWeight: '700' },
});
