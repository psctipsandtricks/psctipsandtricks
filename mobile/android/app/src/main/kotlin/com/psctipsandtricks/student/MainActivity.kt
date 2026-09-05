package com.psctipsandtricks.student

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.view.WindowManager
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

// Host activity. Beyond the Flutter defaults it owns the window's FLAG_SECURE,
// which Dart cannot reach on its own, and a small bridge for writing downloads
// into the device's public Downloads collection so a saved PDF stays reachable
// from the Files app after the app is closed.
//
// Extends `AudioServiceActivity` rather than `FlutterActivity`: the media
// service that keeps a lesson playing with the screen off binds to the engine
// this activity provides, and refuses to start behind a plain one.
class MainActivity : AudioServiceActivity() {

    // Mirrors what Dart last asked for, so the flag survives the activity
    // being recreated (a "don't keep activities" device, or a system-initiated
    // restore) with the reader still on the stack.
    private var secureRequested = false

    // A save request parked while the WRITE_EXTERNAL_STORAGE prompt is up
    // (Android 9 and below only — 10+ needs no permission for MediaStore).
    private var pendingResult: MethodChannel.Result? = null
    private var pendingSource: String? = null
    private var pendingName: String? = null
    private var pendingMime: String? = null

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

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, DOWNLOADS_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "saveToDownloads" -> handleSaveToDownloads(call, result)
                    "openDownloaded" -> handleOpenDownloaded(call, result)
                    else -> result.notImplemented()
                }
            }
    }

    // ── Downloads bridge ──────────────────────────────────────────────────

    private fun handleSaveToDownloads(call: MethodCall, result: MethodChannel.Result) {
        val source = call.argument<String>("sourcePath")
        val name = call.argument<String>("fileName")
        val mime = call.argument<String>("mimeType") ?: "application/octet-stream"
        if (source.isNullOrBlank() || name.isNullOrBlank()) {
            result.error("bad_args", "sourcePath and fileName are required", null)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveAsync(result) { mediaStoreSave(source, name, mime) }
            return
        }

        // Legacy: a direct write into the public Downloads directory, which
        // still needs the runtime storage permission on API 28 and below.
        if (hasLegacyWritePermission()) {
            saveAsync(result) { legacySave(source, name, mime) }
        } else if (pendingResult != null) {
            result.error("busy", "Another save is already awaiting permission", null)
        } else {
            pendingResult = result
            pendingSource = source
            pendingName = name
            pendingMime = mime
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                REQ_WRITE_STORAGE,
            )
        }
    }

    private fun handleOpenDownloaded(call: MethodCall, result: MethodChannel.Result) {
        val uri = call.argument<String>("uri")
        val mime = call.argument<String>("mimeType") ?: "application/octet-stream"
        if (uri.isNullOrBlank()) {
            result.error("bad_args", "uri is required", null)
            return
        }
        try {
            val view = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(uri), mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(Intent.createChooser(view, null))
            result.success(true)
        } catch (e: Exception) {
            result.success(false)
        }
    }

    /// Runs [block] off the UI thread (the copy can be several MB) and hands
    /// the outcome back on it, as MethodChannel requires.
    private fun saveAsync(result: MethodChannel.Result, block: () -> String) {
        Thread {
            try {
                val uri = block()
                runOnUiThread { result.success(uri) }
            } catch (e: Exception) {
                runOnUiThread {
                    result.error("save_failed", e.message ?: "Could not save the file", null)
                }
            }
        }.start()
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun mediaStoreSave(sourcePath: String, fileName: String, mime: String): String {
        val resolver = contentResolver
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, fileName)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values)
            ?: throw IllegalStateException("MediaStore refused the download")
        try {
            resolver.openOutputStream(uri)?.use { out ->
                File(sourcePath).inputStream().use { it.copyTo(out) }
            } ?: throw IllegalStateException("Could not open the download for writing")
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri.toString()
    }

    private fun legacySave(sourcePath: String, fileName: String, mime: String): String {
        @Suppress("DEPRECATION")
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!dir.exists()) dir.mkdirs()

        var dest = File(dir, fileName)
        if (dest.exists()) {
            val dot = fileName.lastIndexOf('.')
            val stem = if (dot > 0) fileName.substring(0, dot) else fileName
            val ext = if (dot > 0) fileName.substring(dot) else ""
            dest = File(dir, "${stem}_${System.currentTimeMillis() % 100000}$ext")
        }
        File(sourcePath).inputStream().use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        }
        MediaScannerConnection.scanFile(this, arrayOf(dest.absolutePath), arrayOf(mime), null)
        return Uri.fromFile(dest).toString()
    }

    private fun hasLegacyWritePermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
            PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_WRITE_STORAGE) return

        val result = pendingResult ?: return
        val source = pendingSource
        val name = pendingName
        val mime = pendingMime ?: "application/octet-stream"
        pendingResult = null
        pendingSource = null
        pendingName = null
        pendingMime = null

        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        if (granted && source != null && name != null) {
            saveAsync(result) { legacySave(source, name, mime) }
        } else {
            result.error(
                "permission_denied",
                "Storage permission is required to save downloads",
                null,
            )
        }
    }

    // ── Secure screen ────────────────────────────────────────────────────

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

        // Must match `_channel` in `lib/core/utils/file_saver.dart`.
        private const val DOWNLOADS_CHANNEL = "psc/downloads"
        private const val REQ_WRITE_STORAGE = 4711
    }
}
