package com.fitview

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import com.mrousavy.camera.core.types.Orientation
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.SharedArray
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Phase 3 (spec): on-device pose that never leaves the frame-processor thread.
 *
 * JS usage (inside a worklet):  const r = plugin.call(frame, { mirror: true, mask: false })
 *
 * - Runs MediaPipe PoseLandmarker in VIDEO mode, i.e. SYNCHRONOUSLY, and RETURNS the result to the
 *   calling worklet. Nothing is sent to the JS thread (no per-frame events, unlike
 *   react-native-mediapipe-posedetection).
 * - The frame is copied into a small upright Bitmap first (rotated using the frame's orientation and
 *   mirrored like the front-camera preview), so the returned landmarks are already in the same
 *   orientation as what the user sees on screen. Downscaled to MAX_SIDE px: the pose model's own input
 *   is only 256 px, so the full 1280x720 copy would be wasted work.
 *
 * Returns null when no person is found, otherwise:
 *   { width, height, inferenceMs, landmarks: number[33 * 5] }   // per landmark: x, y, z, visibility, presence
 * x/y are normalized 0..1 in the upright `width` x `height` image.
 *
 * Phase 4: with init option { masks: true } and call param { mask: true } the result also has
 *   { mask: ArrayBuffer (Uint8, maskCols * maskRows, 0..255 = person probability),
 *     maskCols, maskRows, maskCoverage (0..1) }
 * The mask is MediaPipe's person segmentation, aligned with the landmarks, downsampled to a
 * MASK_COLS-wide grid and smoothed over time (EMA) to reduce flicker (spec §9).
 *
 * Requires <Camera pixelFormat="rgb"> (RGBA_8888 frames).
 */
class PoseLandmarksPlugin(private val proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

  companion object {
    private const val TAG = "FitviewPose"
    private const val MAX_SIDE = 480
    private const val VALUES_PER_LANDMARK = 5
    private const val MASK_COLS = 48
    private const val MASK_EMA = 0.5f // weight of the NEW mask; lower = smoother but laggier
  }

  private val landmarker: PoseLandmarker?
  private val masksEnabled: Boolean
  private var maskEma: FloatArray? = null
  private var maskEmaCols = 0
  private var maskEmaRows = 0
  private var lastTimestampMs = -1L

  // Reused between frames to avoid allocating (and triggering GC) every frame.
  private var srcBitmap: Bitmap? = null
  private var tightBuffer: ByteBuffer? = null

  init {
    val model = (options?.get("model") as? String) ?: "pose_landmarker_lite.task"
    val useGpu = (options?.get("gpu") as? Boolean) ?: false
    masksEnabled = (options?.get("masks") as? Boolean) ?: false
    landmarker = try {
      val base = BaseOptions.builder()
        .setModelAssetPath(model)
        .setDelegate(if (useGpu) Delegate.GPU else Delegate.CPU)
        .build()
      val opts = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(base)
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinPosePresenceConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .setOutputSegmentationMasks(masksEnabled)
        .build()
      PoseLandmarker.createFromOptions(proxy.context, opts).also {
        Log.i(TAG, "PoseLandmarker ready (model=$model, gpu=$useGpu, masks=$masksEnabled)")
      }
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to create PoseLandmarker: ${e.message}", e)
      null
    }
  }

  override fun callback(frame: Frame, params: MutableMap<String, Any>?): Any? {
    // Never let a native problem crash the JS frame processor: log it and report "no pose".
    return try {
      detect(frame, params)
    } catch (e: Throwable) {
      Log.w(TAG, "pose callback failed", e)
      // Reported to JS (debug box) instead of crashing the frame processor.
      hashMapOf<String, Any>("error" to "${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun detect(frame: Frame, params: MutableMap<String, Any>?): Any? {
    val detector = landmarker ?: return null
    val mirror = (params?.get("mirror") as? Boolean) ?: false
    val wantMask = masksEnabled && ((params?.get("mask") as? Boolean) ?: false)

    val upright = toUprightBitmap(frame, mirror) ?: return null

    // VIDEO mode needs strictly increasing timestamps (ms).
    var ts = frame.timestamp / 1_000_000L
    if (ts <= lastTimestampMs) ts = lastTimestampMs + 1
    lastTimestampMs = ts

    val start = SystemClock.uptimeMillis()
    // NOTE: with segmentation masks enabled, MediaPipe returns NULL (not an empty result) for frames
    // without a person. Kotlin sees a non-null platform type here, so check explicitly.
    val result: PoseLandmarkerResult? = try {
      detector.detectForVideo(BitmapImageBuilder(upright).build(), ts)
    } catch (e: Throwable) {
      Log.w(TAG, "detectForVideo failed: ${e.message}")
      null
    }
    if (result == null) return null
    val inferenceMs = (SystemClock.uptimeMillis() - start).toDouble()

    val pose = result.landmarks().firstOrNull() ?: return null
    val flat = ArrayList<Double>(pose.size * VALUES_PER_LANDMARK)
    for (lm in pose) {
      flat.add(lm.x().toDouble())
      flat.add(lm.y().toDouble())
      flat.add(lm.z().toDouble())
      flat.add(lm.visibility().orElse(0f).toDouble())
      flat.add(lm.presence().orElse(0f).toDouble())
    }

    val out = hashMapOf<String, Any>(
      "width" to upright.width.toDouble(),
      "height" to upright.height.toDouble(),
      "inferenceMs" to inferenceMs,
      "landmarks" to flat,
    )

    if (wantMask) {
      // A mask problem must never cost us the pose: landmarks are returned either way.
      try {
        val maskImage = result.segmentationMasks().orElse(null)?.firstOrNull()
        if (maskImage != null) addMask(maskImage, out) else out["maskError"] = "no mask in result"
      } catch (e: Throwable) {
        Log.w(TAG, "mask failed", e)
        out["maskError"] = "${e.javaClass.simpleName}: ${e.message}"
      }
    }
    return out
  }

  /** Float person mask -> small Uint8 grid, EMA-smoothed across frames, returned as an ArrayBuffer. */
  private fun addMask(maskImage: MPImage, out: HashMap<String, Any>) {
    val mw = maskImage.width
    val mh = maskImage.height
    if (mw <= 0 || mh <= 0) return
    val floats = ByteBufferExtractor.extract(maskImage).order(ByteOrder.nativeOrder()).asFloatBuffer()

    val cols = MASK_COLS
    val rows = maxOf(1, Math.round(cols * mh.toFloat() / mw.toFloat()))
    var ema = maskEma
    val fresh = ema == null || maskEmaCols != cols || maskEmaRows != rows
    if (fresh) {
      ema = FloatArray(cols * rows)
      maskEma = ema
      maskEmaCols = cols
      maskEmaRows = rows
    }
    val e: FloatArray = ema!!

    val shared = SharedArray(proxy, cols * rows)
    val bytes = shared.byteBuffer
    bytes.rewind()
    var covered = 0
    for (r in 0 until rows) {
      val py = minOf(mh - 1, ((r + 0.5f) * mh / rows).toInt())
      for (c in 0 until cols) {
        val px = minOf(mw - 1, ((c + 0.5f) * mw / cols).toInt())
        val v = floats.get(py * mw + px).coerceIn(0f, 1f)
        val i = r * cols + c
        val smoothed = if (fresh) v else e[i] + MASK_EMA * (v - e[i])
        e[i] = smoothed
        if (smoothed >= 0.5f) covered++
        bytes.put((smoothed * 255f).toInt().toByte())
      }
    }

    out["mask"] = shared
    out["maskCols"] = cols.toDouble()
    out["maskRows"] = rows.toDouble()
    out["maskCoverage"] = covered.toDouble() / (cols * rows).toDouble()
  }

  /** RGBA frame -> small, upright (and optionally mirrored) Bitmap. */
  private fun toUprightBitmap(frame: Frame, mirror: Boolean): Bitmap? {
    val image = frame.image
    val w = image.width
    val h = image.height
    val plane = image.planes.firstOrNull() ?: return null
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride
    if (pixelStride != 4) {
      Log.w(TAG, "Expected RGBA frames (pixelStride 4) but got $pixelStride. Use pixelFormat=\"rgb\".")
      return null
    }

    var bmp = srcBitmap
    if (bmp == null || bmp.width != w || bmp.height != h) {
      bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      srcBitmap = bmp
    }

    val src = plane.buffer.duplicate()
    src.rewind()
    if (rowStride == w * 4) {
      bmp!!.copyPixelsFromBuffer(src)
    } else {
      // Rows are padded: copy them into a tight buffer first.
      val needed = w * h * 4
      var tight = tightBuffer
      if (tight == null || tight.capacity() != needed) {
        tight = ByteBuffer.allocateDirect(needed)
        tightBuffer = tight
      }
      tight!!.clear()
      val row = ByteArray(w * 4)
      for (y in 0 until h) {
        src.position(y * rowStride)
        src.get(row, 0, w * 4)
        tight.put(row)
      }
      tight.rewind()
      bmp!!.copyPixelsFromBuffer(tight)
    }

    // Clockwise rotation that makes the frame upright. VisionCamera's Frame.orientation is the
    // REVERSE of CameraX's rotationDegrees (see Frame.getOrientation()), so map it back here.
    // (We can't read imageProxy.imageInfo directly: CameraX isn't on the app module's classpath.)
    val rotation = when (frame.orientation) {
      Orientation.PORTRAIT -> 0
      Orientation.LANDSCAPE_RIGHT -> 90
      Orientation.PORTRAIT_UPSIDE_DOWN -> 180
      Orientation.LANDSCAPE_LEFT -> 270
    }
    val needMirror = mirror && !frame.isMirrored
    val scale = MAX_SIDE.toFloat() / maxOf(w, h).toFloat()
    val m = Matrix().apply {
      postScale(scale, scale)
      postRotate(rotation.toFloat())
      if (needMirror) postScale(-1f, 1f)
    }
    // Move the transformed image back to (0,0) and size the output to it.
    val bounds = RectF(0f, 0f, w.toFloat(), h.toFloat())
    m.mapRect(bounds)
    m.postTranslate(-bounds.left, -bounds.top)
    val outW = Math.round(bounds.width())
    val outH = Math.round(bounds.height())

    var out = outBitmap
    if (out == null || out.width != outW || out.height != outH) {
      out = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
      outBitmap = out
      outCanvas = Canvas(out)
    }
    outCanvas!!.drawBitmap(bmp!!, m, paint)
    return out
  }

  private var outBitmap: Bitmap? = null
  private var outCanvas: Canvas? = null
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
}
