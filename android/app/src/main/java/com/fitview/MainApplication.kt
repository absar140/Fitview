package com.fitview

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Phase 3: on-device pose plugin, callable from VisionCamera worklets as "fitviewPose".
    // Must be registered before the JS bundle calls VisionCameraProxy.initFrameProcessorPlugin().
    FrameProcessorPluginRegistry.addFrameProcessorPlugin("fitviewPose") { proxy, options ->
      PoseLandmarksPlugin(proxy, options)
    }
    loadReactNative(this)
  }
}
