package com.psctipsandtricks.student

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// Host activity. Beyond the Flutter defaults it owns the window's FLAG_SECURE,
// which Dart cannot reach on its own.
class MainActivity : FlutterActivity() {

    // Mirrors what Dart last asked for, so the flag survives the activity
    // being recreated (a "don't keep activities" device, or a system-initiated
    // restore) with the reader still on the stack.
    private var secureRequested = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SECURE_SCREEN_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Blocks screenshots, screen recording and casting, and
                    // blanks the app's thumbnail in the recents switcher, for
                    // as long as the flag is set.
                    "enable" -> {
                        secureRequested = true
                        applySecureFlag()
                        result.success(null)
                    }
                    "disable" -> {
                        secureRequested = false
                        applySecureFlag()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onResume() {
        super.onResume()
        // Re-assert after a recreation: the flag lives on the window, not the
        // process, so a new window comes up without it.
        applySecureFlag()
    }

    // Method-channel calls and lifecycle callbacks both arrive on the UI
    // thread, which is the only thread allowed to touch the window.
    private fun applySecureFlag() {
        if (secureRequested) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    companion object {
        // Must match `_channel` in `lib/core/utils/secure_screen.dart`.
        private const val SECURE_SCREEN_CHANNEL = "psc/secure_screen"
    }
}
