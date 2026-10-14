/**
 * Phase 3 (spec): pose tracking entirely on the frame-processor (worklet) thread.
 *
 *   camera frame ──► fitviewPose native plugin (MediaPipe, synchronous)
 *                ──► confidence check (visibility of shoulders + hips)
 *                ──► garment anchor maths (position / scale / roll)
 *                ──► One-Euro smoothing
 *                ──► shared values ──► Filament render thread (GarmentModel)
 *
 * The JS thread only hears about low-frequency events: tracking started / lost (spec §12).
 * No camera frames or per-frame landmarks ever reach React state.
 *
 * Worklet rules followed here: no array/object destructuring inside worklets (Babel turns it into
 * helper functions the worklet runtime cannot capture), only plain numbers/arrays in shared values.
 */
import { useCallback, useEffect, useMemo } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { getMaskPlugin, getPosePlugin } from './posePlugins';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import type { ISharedValue } from 'react-native-worklets-core';

// ---- tuning (same values the screen used before, now in one place) ----
const CAMERA_Z = 3;
const VERTICAL_FOV_DEG = 45;
const VISIBLE_HEIGHT_AT_ORIGIN = 2 * CAMERA_Z * Math.tan((VERTICAL_FOV_DEG * Math.PI) / 360);
const UNIT_CUBE_SIZE = 2;
const ROLL_SIGN = -1;
const POSE_FPS = 15; // spec: pose 15–30 FPS initially
const MIN_VISIBILITY = 0.5; // spec: confidence thresholds + tracking-lost state
const MAX_MISSED_FRAMES = 5;
// One-Euro filter (spec §8): low jitter when still, low lag when moving. Tuned PER CHANNEL,
// order: [x, y, scale, roll, yaw]. Scale gets by far the strongest smoothing: it comes from the
// shoulder width, which is the noisiest measurement, and any scale jitter reads as "zooming".
const OE_MIN_CUTOFF = [1.0, 1.0, 0.25, 0.6, 0.6]; // Hz — lower = smoother when standing still
const OE_BETA = [0.6, 0.6, 0.05, 0.2, 0.2]; // higher = less lag on fast moves
const OE_D_CUTOFF = 1.0;
// Ignore scale changes smaller than this fraction (pure landmark noise), so the shirt doesn't "breathe".
const SCALE_DEADBAND = 0.04;

// MediaPipe pose landmark indices
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_INDEX = 19;
const R_INDEX = 20;
const STRIDE = 5; // x, y, z, visibility, presence

// ---- Phase 4b: arm occluders (category rule for shirts: forearms + hands may cover the torso;
// upper arms stay under the sleeves, so they never punch through) ----
const OCC_Z = 1.0; // world z of the occluders: in front of the garment (camera is at z = 3)
const OCC_DIAMETER_PER_SHOULDER = 0.26; // forearm thickness relative to shoulder width
const OCC_HAND_EXTEND = 1.0; // extend past the wrist by this × (wrist→index finger) to cover the hand
const OCC_BEHIND_Z = 0.15; // MediaPipe z: arm this much farther than the shoulders = behind the body
// Phase 4: the person mask refines the occluders (spec §9 "connect mask to occlusion").
const MASK_PERSON = 128; // mask value 0..255 at or above which a cell is "person"
const OCC_MIN_DIAMETER_PER_SHOULDER = 0.14; // clamp the mask-measured forearm thickness
const OCC_MAX_DIAMETER_PER_SHOULDER = 0.45;
const OCC_DIAMETER_EMA = 0.35; // smoothing of the measured thickness between pose updates
/** Per side: [x0, y0, x1, y1, diameter, z, active]; left side at 0..6, right side at 7..13 */
export const OCC_STRIDE = 7;
export const OCC_EMPTY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/**
 * Pose -> 3D bridge. Written on the frame-processor thread, read on the Filament render thread.
 * x/y = SHOULDER MIDPOINT in world units, s = garment scale, roll/yaw in radians.
 */
export type PoseShared = {
  x: ISharedValue<number>;
  y: ISharedValue<number>;
  s: ISharedValue<number>;
  roll: ISharedValue<number>;
  yaw: ISharedValue<number>;
  visible: ISharedValue<number>; // 1 = show, 0 = hide
};

export type GarmentFit = { widthFraction: number; shoulderFactor: number };

export type PoseStats = {
  frames: ISharedValue<number>; // frames analysed
  found: ISharedValue<number>; // frames with a confident pose
  inferenceMs: ISharedValue<number>;
  shoulderVis: ISharedValue<number>; // min visibility of the 2 shoulders in the last result
  masksUsed: ISharedValue<number>; // pose results that came with a person mask (Phase 4)
  occLeft: ISharedValue<number>; // 1 = left forearm occluder active
  occRight: ISharedValue<number>; // 1 = right forearm occluder active
  occThickL: ISharedValue<number>; // learned forearm thickness / shoulder width (0 = not measured yet)
  occThickR: ISharedValue<number>;
  hipVis: ISharedValue<number>; // min visibility of the 2 hips (hips may be off-screen; that's OK)
  lastError: ISharedValue<string>; // last native error reported by the plugin ('' = none)
  maskMode: ISharedValue<number>; // 1 = using the person mask, 0 = pose only (mask off / fell back)
};

// Phase 4: use the person mask to gate/size the forearm occluders.
// AUTO mode: Try-On starts with the mask landmarker. If the mask path misbehaves on this phone it
// switches itself to the pose-only landmarker for the rest of the session, so the shirt never
// disappears because of the mask:
//   - native error from the mask landmarker                        -> fall back at once
//   - MASK_ERRORS_TO_FALLBACK results in a row with a pose but no mask -> fall back
//   - MASK_NULLS_TO_PROBE nulls in a row: run ONE frame with the pose-only landmarker. If that one
//     finds the shoulders, masks are what hide the person -> fall back. If not, nobody is in front
//     of the camera -> keep the mask.
// Set to false to never use the mask (pose-only, the known-good path).
const USE_MASK_FOR_OCCLUSION = true;
const MASK_ERRORS_TO_FALLBACK = 5;
const MASK_NULLS_TO_PROBE = 5;

/** Smooths 5 channels (x, y, s, roll, yaw). state = [init, tPrev, x0..x4, dx0..dx4] */
function oneEuroStep(state: number[], values: number[], tSec: number): number[] {
  'worklet';
  const out: number[] = [1, tSec, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (state[0] < 0.5) {
    for (let i = 0; i < 5; i++) {
      out[2 + i] = values[i];
      out[7 + i] = 0;
    }
    return out;
  }
  let dt = tSec - state[1];
  if (dt <= 1e-4) dt = 1 / POSE_FPS;
  const aD = 1 / (1 + 1 / (2 * Math.PI * OE_D_CUTOFF * dt));
  for (let i = 0; i < 5; i++) {
    const prev = state[2 + i];
    const dxRaw = (values[i] - prev) / dt;
    const dx = state[7 + i] + aD * (dxRaw - state[7 + i]);
    const cutoff = OE_MIN_CUTOFF[i] + OE_BETA[i] * Math.abs(dx);
    const a = 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    out[2 + i] = prev + a * (values[i] - prev);
    out[7 + i] = dx;
  }
  return out;
}

// NOTE: must stay ABOVE every worklet that calls it (armOccluder, the frame processor). The worklet
// Babel plugin captures helper functions when a worklet is DEFINED, so a helper declared below it
// is still undefined at that moment -> "undefined is not a function".
/** Normalised point in the upright image -> view pixels, for <Camera resizeMode="cover">. */
function toView(nx: number, ny: number, imgW: number, imgH: number, viewW: number, viewH: number): number[] {
  'worklet';
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const offX = (viewW - imgW * scale) / 2;
  const offY = (viewH - imgH * scale) / 2;
  return [nx * imgW * scale + offX, ny * imgH * scale + offY];
}

/**
 * One forearm occluder in world units (already perspective-compensated for z = OCC_Z, so it lines
 * up on screen with the real arm). Returns [x0, y0, x1, y1, diameter, z, active, measuredRatio]
 * where measuredRatio = forearm thickness / shoulder width when the mask could measure it, else -1.
 * The thickness can only be measured while the forearm is BESIDE the body (person on one side,
 * background on the other). When it is IN FRONT of the body (the case that matters for occlusion)
 * the last measured ratio (learnedRatio) is used.
 */
function maskIsPerson(mask: Uint8Array, cols: number, rows: number, px: number, py: number, iw: number, ih: number): boolean {
  'worklet';
  const c = Math.floor((px / iw) * cols);
  const r = Math.floor((py / ih) * rows);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
  return mask[r * cols + c] >= MASK_PERSON;
}

/**
 * Forearm thickness in IMAGE pixels, measured on the person mask: walk outwards from the forearm's
 * middle, perpendicular to it, until the mask says "not person" on each side. -1 = not measurable.
 */
function measureForearm(
  mask: Uint8Array, cols: number, rows: number, iw: number, ih: number,
  ex: number, ey: number, wx: number, wy: number
): number {
  'worklet';
  const len = Math.hypot(wx - ex, wy - ey);
  if (len < 1) return -1;
  const mx = (ex + wx) / 2;
  const my = (ey + wy) / 2;
  if (!maskIsPerson(mask, cols, rows, mx, my, iw, ih)) return -1;
  const nx = -(wy - ey) / len; // unit perpendicular
  const ny = (wx - ex) / len;
  const step = iw / cols; // one mask cell
  const maxSteps = Math.ceil(len / step); // a forearm is never wider than it is long
  let left = 0;
  while (left < maxSteps && maskIsPerson(mask, cols, rows, mx - nx * step * (left + 1), my - ny * step * (left + 1), iw, ih)) left++;
  let right = 0;
  while (right < maxSteps && maskIsPerson(mask, cols, rows, mx + nx * step * (right + 1), my + ny * step * (right + 1), iw, ih)) right++;
  if (left >= maxSteps || right >= maxSteps) return -1; // ran into the torso: arm is over the body, can't measure
  return (left + right + 1) * step;
}

function armOccluder(
  lm: number[], iElbow: number, iWrist: number, iIndex: number,
  iw: number, ih: number, w: number, h: number,
  worldPerPx: number, shoulderZ: number, shoulderWorld: number,
  mask: Uint8Array | null, mCols: number, mRows: number, prevDiameter: number, learnedRatio: number
): number[] {
  'worklet';
  const vE = lm[iElbow * STRIDE + 3];
  const vW = lm[iWrist * STRIDE + 3];
  if (vE < MIN_VISIBILITY || vW < MIN_VISIBILITY) return [0, 0, 0, 0, 0, 0, 0, -1];
  const armZ = (lm[iElbow * STRIDE + 2] + lm[iWrist * STRIDE + 2]) / 2;
  if (armZ > shoulderZ + OCC_BEHIND_Z) return [0, 0, 0, 0, 0, 0, 0, -1]; // arm behind the body

  const e = toView(lm[iElbow * STRIDE], lm[iElbow * STRIDE + 1], iw, ih, w, h);
  const wr = toView(lm[iWrist * STRIDE], lm[iWrist * STRIDE + 1], iw, ih, w, h);
  let endX = wr[0];
  let endY = wr[1];
  if (lm[iIndex * STRIDE + 3] >= MIN_VISIBILITY) {
    const ix = toView(lm[iIndex * STRIDE], lm[iIndex * STRIDE + 1], iw, ih, w, h);
    endX = wr[0] + (ix[0] - wr[0]) * OCC_HAND_EXTEND;
    endY = wr[1] + (ix[1] - wr[1]) * OCC_HAND_EXTEND;
  } else {
    endX = wr[0] + (wr[0] - e[0]) * 0.25;
    endY = wr[1] + (wr[1] - e[1]) * 0.25;
  }
  // screen px -> world at z = 0, then pull towards the camera to z = OCC_Z (same screen position)
  const k = (CAMERA_Z - OCC_Z) / CAMERA_Z;
  const x0 = (e[0] - w / 2) * worldPerPx * k;
  const y0 = -(e[1] - h / 2) * worldPerPx * k;
  const x1 = (endX - w / 2) * worldPerPx * k;
  const y1 = -(endY - h / 2) * worldPerPx * k;
  const perShoulder = shoulderWorld * k;
  let diameter = perShoulder * (learnedRatio > 0 ? learnedRatio : OCC_DIAMETER_PER_SHOULDER);
  let measuredRatio = -1;

  if (mask != null) {
    // landmarks in IMAGE pixels (mask space)
    const exI = lm[iElbow * STRIDE] * iw;
    const eyI = lm[iElbow * STRIDE + 1] * ih;
    const wxI = lm[iWrist * STRIDE] * iw;
    const wyI = lm[iWrist * STRIDE + 1] * ih;
    // Gate: if neither the forearm's middle nor the wrist is "person" in the mask, the landmarks are
    // guesses (e.g. arm out of frame) -> don't punch a hole.
    const midOk = maskIsPerson(mask, mCols, mRows, (exI + wxI) / 2, (eyI + wyI) / 2, iw, ih);
    const wristOk = maskIsPerson(mask, mCols, mRows, wxI, wyI, iw, ih);
    if (!midOk && !wristOk) return [0, 0, 0, 0, 0, 0, 0, -1];

    const widthImg = measureForearm(mask, mCols, mRows, iw, ih, exI, eyI, wxI, wyI);
    if (widthImg > 0) {
      const coverScale = Math.max(w / iw, h / ih); // image px -> view px
      let ratio = (widthImg * coverScale * worldPerPx * k) / perShoulder;
      // Wider than any forearm = we measured the torso behind it (arm in front of the body):
      // not a valid measurement, keep the learned / default thickness.
      if (ratio <= OCC_MAX_DIAMETER_PER_SHOULDER) {
        if (ratio < OCC_MIN_DIAMETER_PER_SHOULDER) ratio = OCC_MIN_DIAMETER_PER_SHOULDER;
        measuredRatio = ratio;
        diameter = perShoulder * ratio;
      }
    }
  }
  if (prevDiameter > 0) diameter = prevDiameter + OCC_DIAMETER_EMA * (diameter - prevDiameter);
  return [x0, y0, x1, y1, diameter, OCC_Z, 1, measuredRatio];
}


type Options = {
  pose: PoseShared;
  /** true for the front camera: landmarks are mirrored to match the selfie preview */
  mirror: boolean;
  fit: GarmentFit;
  /** keep the garment visible (centre) when no person is tracked — debugging only */
  forceShow: boolean;
  onTrackingChange: (tracking: boolean) => void;
  /** Phase 4b: arm occluder segments for the Filament holdout (see OCC_STRIDE) */
  occluders?: ISharedValue<number[]>;
};

export function usePoseTracking({ pose, mirror, fit, forceShow, onTrackingChange, occluders }: Options) {
  const viewW = useSharedValue(1);
  const viewH = useSharedValue(1);
  const fitShoulder = useSharedValue(fit.shoulderFactor);
  const fitWidth = useSharedValue(fit.widthFraction);
  const filter = useSharedValue<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const missed = useSharedValue(0);
  const tracking = useSharedValue(0);

  const frames = useSharedValue(0);
  const found = useSharedValue(0);
  const inferenceMs = useSharedValue(0);
  const shoulderVis = useSharedValue(0);
  const hipVis = useSharedValue(0);
  const masksUsed = useSharedValue(0);
  const occLeft = useSharedValue(0);
  const occRight = useSharedValue(0);
  const occThickL = useSharedValue(0);
  const occThickR = useSharedValue(0);
  const lastError = useSharedValue('');
  const maskMode = useSharedValue(USE_MASK_FOR_OCCLUSION && occluders != null ? 1 : 0);
  const maskNulls = useSharedValue(0);
  const maskErrors = useSharedValue(0);
  const learnL = useSharedValue(0);
  const learnR = useSharedValue(0);
  const stats: PoseStats = useMemo(
    () => ({ frames, found, inferenceMs, shoulderVis, hipVis, masksUsed, occLeft, occRight, occThickL, occThickR, lastError, maskMode }),
    [frames, found, inferenceMs, shoulderVis, hipVis, masksUsed, occLeft, occRight, occThickL, occThickR, lastError, maskMode]
  );

  // garment switch: new fit numbers, no camera restart (spec §16)
  useEffect(() => {
    fitShoulder.value = fit.shoulderFactor;
    fitWidth.value = fit.widthFraction;
  }, [fit.shoulderFactor, fit.widthFraction, fitShoulder, fitWidth]);

  // camera switch: restart smoothing so the garment doesn't slide across the screen
  useEffect(() => {
    filter.value = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }, [mirror, filter]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewW.value = e.nativeEvent.layout.width;
      viewH.value = e.nativeEvent.layout.height;
    },
    [viewW, viewH]
  );

  const notifyTracking = useRunOnJS(onTrackingChange, [onTrackingChange]);
  const px = pose.x;
  const py = pose.y;
  const ps = pose.s;
  const proll = pose.roll;
  const pyaw = pose.yaw;
  const pvisible = pose.visible;
  const plugin = useMemo(() => getPosePlugin(), []);
  // Only loaded when the mask can be used (a second MediaPipe model in memory).
  const maskPlugin = useMemo(() => (USE_MASK_FOR_OCCLUSION && occluders != null ? getMaskPlugin() : undefined), [occluders]);
  const occ = occluders;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (plugin == null) return;
      runAtTargetFps(POSE_FPS, () => {
        'worklet';
        frames.value = frames.value + 1;
        const useMask = maskPlugin != null && maskMode.value > 0.5;
        // probe = this one frame goes through the pose-only landmarker to test the mask landmarker
        const probe = useMask && maskNulls.value >= MASK_NULLS_TO_PROBE;
        let r: any;
        if (useMask && !probe) {
          r = maskPlugin!.call(frame, { mirror: mirror, mask: true }) as any;
          if (r == null) {
            maskNulls.value = maskNulls.value + 1;
          } else if (r.error != null) {
            maskMode.value = 0;
            lastError.value = 'mask off (native error): ' + String(r.error).slice(0, 130);
            r = null;
          } else {
            maskNulls.value = 0;
            if (r.mask == null) {
              maskErrors.value = maskErrors.value + 1;
              if (maskErrors.value >= MASK_ERRORS_TO_FALLBACK) {
                maskMode.value = 0;
                lastError.value = 'mask off: ' + (r.maskError != null ? String(r.maskError).slice(0, 140) : 'no mask in results');
              }
            } else {
              maskErrors.value = 0;
            }
          }
        } else {
          r = plugin.call(frame, { mirror: mirror, mask: false }) as any;
          if (probe) {
            maskNulls.value = 0;
            if (r != null && r.landmarks != null) {
              const pv = Math.min(r.landmarks[L_SHOULDER * STRIDE + 3], r.landmarks[R_SHOULDER * STRIDE + 3]);
              if (pv >= MIN_VISIBILITY) {
                maskMode.value = 0;
                lastError.value = 'mask off: mask landmarker found no pose, pose-only did';
              }
            }
          }
        }

        let ok = false;
        if (r != null && r.error != null) {
          lastError.value = String(r.error).slice(0, 160);
        } else if (r != null && r.landmarks != null) {
          inferenceMs.value = r.inferenceMs;
          const lm = r.landmarks as number[];
          const vLS = lm[L_SHOULDER * STRIDE + 3];
          const vRS = lm[R_SHOULDER * STRIDE + 3];
          const vLH = lm[L_HIP * STRIDE + 3];
          const vRH = lm[R_HIP * STRIDE + 3];
          shoulderVis.value = Math.min(vLS, vRS);
          hipVis.value = Math.min(vLH, vRH);
          // Shoulders are required. Hips are only reported: they are often outside the frame when the
          // phone is close, and the garment is anchored to the shoulder line anyway.
          ok = vLS >= MIN_VISIBILITY && vRS >= MIN_VISIBILITY;

          if (ok) {
            const iw = r.width as number;
            const ih = r.height as number;
            const w = viewW.value;
            const h = viewH.value;
            let a = toView(lm[L_SHOULDER * STRIDE], lm[L_SHOULDER * STRIDE + 1], iw, ih, w, h);
            let b = toView(lm[R_SHOULDER * STRIDE], lm[R_SHOULDER * STRIDE + 1], iw, ih, w, h);
            if (a[0] > b[0]) {
              const t = a;
              a = b;
              b = t;
            }

            const worldPerPx = VISIBLE_HEIGHT_AT_ORIGIN / h;
            const smx = (a[0] + b[0]) / 2;
            const smy = (a[1] + b[1]) / 2;
            const shoulderPx = Math.hypot(b[0] - a[0], b[1] - a[1]);
            // Anchor = shoulder midpoint (world). GarmentModel hangs the garment below it so the collar
            // sits just above the shoulder line, and rotates it around this point.
            const targetX = (smx - w / 2) * worldPerPx;
            const targetY = -(smy - h / 2) * worldPerPx;
            const targetS = (shoulderPx * fitShoulder.value * worldPerPx) / (UNIT_CUBE_SIZE * fitWidth.value);
            const targetRoll = ROLL_SIGN * Math.atan2(b[1] - a[1], b[0] - a[0]);

            const tSec = frame.timestamp / 1e9;
            const prevState = filter.value;
            let sIn = targetS;
            if (prevState[0] > 0.5 && Math.abs(targetS - prevState[4]) < SCALE_DEADBAND * prevState[4]) {
              sIn = prevState[4]; // inside the dead-band: keep the current size
            }
            const next = oneEuroStep(prevState, [targetX, targetY, sIn, targetRoll, 0], tSec);
            filter.value = next;

            px.value = next[2];
            py.value = next[3];
            ps.value = next[4];
            proll.value = next[5];
            pyaw.value = next[6];
            pvisible.value = 1;

            if (occ != null) {
              const shoulderZ = (lm[L_SHOULDER * STRIDE + 2] + lm[R_SHOULDER * STRIDE + 2]) / 2;
              const shoulderWorld = shoulderPx * worldPerPx;
              const hasMask = r.mask != null;
              const mask = hasMask ? new Uint8Array(r.mask as ArrayBuffer) : null;
              const mCols = hasMask ? (r.maskCols as number) : 0;
              const mRows = hasMask ? (r.maskRows as number) : 0;
              if (hasMask) masksUsed.value = masksUsed.value + 1;
              const prev = occ.value;
              const prevL = prev.length >= OCC_STRIDE * 2 && prev[6] > 0.5 ? prev[4] : 0;
              const prevR = prev.length >= OCC_STRIDE * 2 && prev[13] > 0.5 ? prev[11] : 0;
              const left = armOccluder(lm, L_ELBOW, L_WRIST, L_INDEX, iw, ih, w, h, worldPerPx, shoulderZ, shoulderWorld, mask, mCols, mRows, prevL, learnL.value);
              const right = armOccluder(lm, R_ELBOW, R_WRIST, R_INDEX, iw, ih, w, h, worldPerPx, shoulderZ, shoulderWorld, mask, mCols, mRows, prevR, learnR.value);
              // remember the thickness measured while the arm was beside the body
              if (left[7] > 0) learnL.value = learnL.value > 0 ? learnL.value + 0.3 * (left[7] - learnL.value) : left[7];
              if (right[7] > 0) learnR.value = learnR.value > 0 ? learnR.value + 0.3 * (right[7] - learnR.value) : right[7];
              occLeft.value = left[6];
              occRight.value = right[6];
              occThickL.value = learnL.value;
              occThickR.value = learnR.value;
              occ.value = left.slice(0, OCC_STRIDE).concat(right.slice(0, OCC_STRIDE));
            }
          }
        }

        if (ok) {
          found.value = found.value + 1;
          missed.value = 0;
          if (tracking.value < 0.5) {
            tracking.value = 1;
            notifyTracking(true);
          }
        } else {
          missed.value = missed.value + 1;
          if (missed.value > MAX_MISSED_FRAMES) {
            // spec §5.11: hide instead of showing an obviously wrong position
            if (!forceShow) pvisible.value = 0;
            filter.value = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            if (occ != null) occ.value = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            occLeft.value = 0;
            occRight.value = 0;
            if (tracking.value > 0.5) {
              tracking.value = 0;
              notifyTracking(false);
            }
          }
        }
      });
    },
    [plugin, maskPlugin, maskMode, maskNulls, maskErrors, occ, mirror, forceShow, notifyTracking, px, py, ps, proll, pyaw, pvisible, viewW, viewH, fitShoulder, fitWidth, filter, missed, tracking, frames, found, inferenceMs, shoulderVis, hipVis, masksUsed, occLeft, occRight, occThickL, occThickR, learnL, learnR, lastError]
  );

  return { frameProcessor, onLayout, stats, pluginAvailable: plugin != null };
}
