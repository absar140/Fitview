/**
 * Phase 4 deliverable: "Segmentation debug screen" (spec §9 + §23).
 *
 * Shows MediaPipe's person mask (from our fitviewPose plugin) over the live camera:
 *   - green  = pixels the model thinks are the person (after temporal smoothing)
 *   - HUD    = mask coverage, inference time, frames with a mask
 *
 * Debug-only data path: the worklet turns the small mask grid into ONE SVG path string and sends it
 * to JS ~5 times a second. The real try-on never sends masks to JS.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { getMaskPlugin } from './cv/posePlugins';

const MASK_FPS = 5;
const THRESHOLD = 128; // 0..255; cells at or above count as "person"


type MaskView = { path: string; cols: number; rows: number; coverage: number; inferenceMs: number };
// What the last plugin call returned, for diagnosing the mask path on a device.
type CallInfo = { status: string; error: string };

export default function SegmentationDebugScreen() {
  const navigation = useNavigation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(position);
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }, { fps: 30 }]);

  const [mask, setMask] = useState<MaskView | null>(null);
  const [masksSeen, setMasksSeen] = useState(0);
  const [info, setInfo] = useState<CallInfo>({ status: 'waiting', error: '' });
  const sendInfo = useRunOnJS(setInfo, [setInfo]);

  const onMask = useCallback((m: MaskView | null) => {
    setMask(m);
    if (m) setMasksSeen((n) => n + 1);
  }, []);
  const sendMask = useRunOnJS(onMask, [onMask]);

  const mirror = position === 'front';
  const plugin = useMemo(() => getMaskPlugin(), []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (plugin == null) return;
      runAtTargetFps(MASK_FPS, () => {
        'worklet';
        const r = plugin.call(frame, { mirror: mirror, mask: true }) as any;
        if (r == null) {
          sendInfo({ status: 'null (no person found)', error: '' });
          sendMask(null);
          return;
        }
        if (r.error != null) {
          sendInfo({ status: 'native error', error: String(r.error) });
          sendMask(null);
          return;
        }
        if (r.mask == null) {
          sendInfo({ status: 'pose OK, NO mask', error: r.maskError != null ? String(r.maskError) : '' });
          sendMask(null);
          return;
        }
        sendInfo({ status: 'pose + mask OK', error: '' });
        const cols = r.maskCols as number;
        const rows = r.maskRows as number;
        const px = new Uint8Array(r.mask as ArrayBuffer);
        // Merge each row's runs of "person" cells into rectangles of one path (grid units).
        let d = '';
        for (let y = 0; y < rows; y++) {
          let x = 0;
          while (x < cols) {
            if (px[y * cols + x] >= THRESHOLD) {
              const start = x;
              while (x < cols && px[y * cols + x] >= THRESHOLD) x++;
              d += 'M' + start + ' ' + y + 'h' + (x - start) + 'v1h' + (start - x) + 'z';
            } else {
              x++;
            }
          }
        }
        sendMask({ path: d, cols: cols, rows: rows, coverage: r.maskCoverage as number, inferenceMs: r.inferenceMs as number });
      });
    },
    [plugin, mirror, sendMask, sendInfo]
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
    <View style={styles.container}>
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

      {mask != null && mask.path.length > 0 && (
        // viewBox in mask-grid units + "slice" = the same crop as the camera's resizeMode="cover"
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${mask.cols} ${mask.rows}`}
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
        >
          <Path d={mask.path} fill="rgba(0, 230, 118, 0.45)" />
        </Svg>
      )}

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTitle}>SEGMENTATION DEBUG</Text>
        {plugin == null ? (
          <Text style={[styles.hudText, styles.bad]}>fitviewPose plugin NOT found (rebuild Android)</Text>
        ) : mask == null ? (
          <Text style={[styles.hudText, styles.bad]}>no person / no mask</Text>
        ) : (
          <>
            <Text style={styles.hudText}>mask coverage: {(mask.coverage * 100).toFixed(1)}%</Text>
            <Text style={styles.hudText}>grid: {mask.cols} x {mask.rows}</Text>
            <Text style={styles.hudText}>inference: {Math.round(mask.inferenceMs)} ms</Text>
          </>
        )}
        <Text style={styles.hudText}>masks received: {masksSeen}</Text>
        <Text style={styles.hudText}>last call: {info.status}</Text>
        {info.error !== '' && <Text style={[styles.hudText, styles.bad]}>error: {info.error}</Text>}
        <Text style={styles.hudText}>green = person (smoothed)</Text>
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
  hudTitle: { color: '#00E676', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  hudText: { color: '#fff', fontSize: 12, marginBottom: 2 },
  bad: { color: '#FF5252' },
});
