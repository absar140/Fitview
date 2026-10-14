/**
 * Shared, lazily created instances of the native fitviewPose plugin.
 *
 * Each initFrameProcessorPlugin() call creates a NEW native MediaPipe PoseLandmarker (model loaded
 * into memory). Creating them at module level meant every screen imported by the navigator loaded
 * its own model at app start (3 models at once). Now a model is only loaded the first time a screen
 * that needs it is opened, and then reused.
 *
 * Two variants:
 *  - getPosePlugin(): landmarks only. Used by Try-On and the Pose debug screen. Proven to work.
 *  - getMaskPlugin(): landmarks + person segmentation mask. Used by the Segmentation debug screen
 *    (and by Try-On occlusion only when USE_MASK_FOR_OCCLUSION is switched on).
 */
import { VisionCameraProxy } from 'react-native-vision-camera';

type PosePlugin = ReturnType<typeof VisionCameraProxy.initFrameProcessorPlugin>;

// Experiment: MediaPipe on the GPU can be several times faster than CPU, but some GPUs (e.g. older
// PowerVR) fail. If "with pose" stays at 0 after switching this on, switch it back off.
export const POSE_USE_GPU = false;

const MODEL = 'pose_landmarker_lite.task';

let posePlugin: PosePlugin = undefined;
let posePluginCreated = false;
let maskPlugin: PosePlugin = undefined;
let maskPluginCreated = false;

export function getPosePlugin(): PosePlugin {
  if (!posePluginCreated) {
    posePluginCreated = true;
    posePlugin = VisionCameraProxy.initFrameProcessorPlugin('fitviewPose', { model: MODEL, gpu: POSE_USE_GPU, masks: false });
  }
  return posePlugin;
}

export function getMaskPlugin(): PosePlugin {
  if (!maskPluginCreated) {
    maskPluginCreated = true;
    maskPlugin = VisionCameraProxy.initFrameProcessorPlugin('fitviewPose', { model: MODEL, gpu: POSE_USE_GPU, masks: true });
  }
  return maskPlugin;
}
