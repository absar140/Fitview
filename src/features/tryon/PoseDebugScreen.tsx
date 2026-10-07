import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { usePoseDetection, RunningMode, Delegate } from 'react-native-mediapipe-posedetection';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Line } from 'react-native-svg';

// MediaPipe pose landmark indices
const NAMES: Record<number, string> = {
  0: 'nose',
  11: 'L shoulder', 12: 'R shoulder',
  13: 'L elbow', 14: 'R elbow',
  15: 'L wrist', 16: 'R wrist',
  23: 'L hip', 24: 'R hip',
  25: 'L knee', 26: 'R knee',
  27: 'L ankle', 28: 'R ankle',
  29: 'L heel', 30: 'R heel',
  31: 'L foot', 32: 'R foot',
};
const IDS = Object.keys(NAMES).map(Number);

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];

const MIN_VISIBILITY = 0.5;
const EMA_ALPHA = 0.35;      // same value as TryOnScreen, tune it here to see jitter change
const UI_UPDATE_MS = 100;    // debug overlay refresh (10 Hz). Never do per-frame setState in real try-on.

type Pt = { x: number; y: number; sx: number; sy: number; v: number };

export default function PoseDebugScreen() {
  const navigation = useNavigation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(position);
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 640, height: 480 } },
  ]);

  const smooth = useRef<Record<number, { x: number; y: number }>>({});
  const lastUi = useRef(0);
  const frames = useRef(0);
  const lastFpsAt = useRef(Date.now());
  const fpsRef = useRef(0);

  const [pts, setPts] = useState<Record<number, Pt>>({});
  const [tracking, setTracking] = useState(false);
  const [stats, setStats] = useState({ fps: 0, shoulderPx: 0, rollDeg: 0, visible: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  const pose = usePoseDetection(
    {
      onResults: (result, vc) => {
        // count pose results per second (this is the REAL pose FPS)
        frames.current += 1;
        const now = Date.now();
        if (now - lastFpsAt.current >= 1000) {
          fpsRef.current = frames.current;
          frames.current = 0;
          lastFpsAt.current = now;
        }

        const lm = result.results[0]?.landmarks?.[0];
        if (!lm || lm.length < 33) {
          if (now - lastUi.current > UI_UPDATE_MS) {
            lastUi.current = now;
            setTracking(false);
            setPts({});
          }
          return;
        }

        const dims = vc.getFrameDims(result);
        const next: Record<number, Pt> = {};
        let visible = 0;

        for (const id of IDS) {
          const p = vc.convertPoint(dims, { x: lm[id].x, y: lm[id].y });
          const v = (lm[id] as any).visibility ?? 1;
          const s = smooth.current[id];
          if (!s) {
            smooth.current[id] = { x: p.x, y: p.y };
          } else {
            s.x += EMA_ALPHA * (p.x - s.x);
            s.y += EMA_ALPHA * (p.y - s.y);
          }
          const sm = smooth.current[id];
          if (v >= MIN_VISIBILITY) visible += 1;
          next[id] = { x: p.x, y: p.y, sx: sm.x, sy: sm.y, v };
        }

        // throttle React updates so the JS thread stays free
        if (now - lastUi.current > UI_UPDATE_MS) {
          lastUi.current = now;
          const a = next[11];
          const b = next[12];
          const shoulderPx = Math.hypot(b.x - a.x, b.y - a.y);
          const rollDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          setPts(next);
          setTracking(true);
          setStats({ fps: fpsRef.current, shoulderPx, rollDeg, visible });
        }
      },
      onError: (e) => console.log('Pose error:', e.message),
    },
    RunningMode.LIVE_STREAM,
    'pose_landmarker_lite.task',
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.CPU,
    }
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

  return (
    <View
      style={styles.container}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={30}
        isActive
        photo={false}
        video={false}
        audio={false}
        pixelFormat="rgb"
        resizeMode="cover"
        frameProcessor={pose.frameProcessor}
        onLayout={pose.cameraViewLayoutChangeHandler}
      />

      {/* Skeleton overlay: green = smoothed, red = raw, gray = low confidence */}
      <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
        {BONES.map(([i, j]) => {
          const a = pts[i];
          const b = pts[j];
          if (!a || !b) return null;
          const ok = a.v >= MIN_VISIBILITY && b.v >= MIN_VISIBILITY;
          return (
            <Line
              key={`${i}-${j}`}
              x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy}
              stroke={ok ? '#00E676' : '#777777'}
              strokeWidth={3}
            />
          );
        })}
        {IDS.map((id) => {
          const p = pts[id];
          if (!p) return null;
          const ok = p.v >= MIN_VISIBILITY;
          return (
            <React.Fragment key={id}>
              <Circle cx={p.x} cy={p.y} r={4} fill={ok ? '#FF1744' : '#777777'} />
              <Circle cx={p.sx} cy={p.sy} r={6} fill="none" stroke={ok ? '#00E676' : '#777777'} strokeWidth={2} />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* HUD */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={[styles.hudText, { color: tracking ? '#00E676' : '#FF1744' }]}>
          {tracking ? 'TRACKING' : 'LOST - move into frame'}
        </Text>
        <Text style={styles.hudText}>pose FPS: {stats.fps}</Text>
        <Text style={styles.hudText}>visible landmarks: {stats.visible}/{IDS.length}</Text>
        <Text style={styles.hudText}>shoulder width: {stats.shoulderPx.toFixed(0)} px</Text>
        <Text style={styles.hudText}>shoulder roll: {stats.rollDeg.toFixed(1)}°</Text>
        <Text style={styles.hudText}>red = raw, green = smoothed (EMA {EMA_ALPHA})</Text>
      </View>

      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            smooth.current = {};
            setPosition((p) => (p === 'front' ? 'back' : 'front'));
          }}
        >
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
  hud: { position: 'absolute', top: 100, left: 12, backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, borderRadius: 8 },
  hudText: { color: '#fff', fontSize: 12, marginBottom: 2 },
});
