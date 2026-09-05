import 'dart:io';

import 'package:flutter/services.dart';

/// Bridge to the host activity for putting a file into the device's public
/// Downloads collection.
///
/// The point is reach *outside* the app: a PDF saved this way shows up in the
/// system Files / Downloads app and any PDF reader, and survives the app being
/// closed or uninstalled — unlike anything under the app's own sandbox.
class FileSaver {
  const FileSaver._();

  static const MethodChannel _channel = MethodChannel('psc/downloads');

  /// Copies the file at [sourcePath] into the public Downloads folder as
  /// [fileName], and returns a URI string for the stored copy:
  ///   * `content://…` on Android 10+ (via MediaStore),
  ///   * `file://…` on Android 9 and below.
  ///
  /// Throws [PlatformException] on failure — code `permission_denied` when the
  /// user declines the storage prompt on an older device.
  static Future<String> saveToDownloads({
    required String sourcePath,
    required String fileName,
    String mimeType = 'application/octet-stream',
  }) async {
    if (!Platform.isAndroid) {
      throw UnsupportedError('saveToDownloads is only implemented on Android.');
    }
    final uri = await _channel.invokeMethod<String>('saveToDownloads', {
      'sourcePath': sourcePath,
      'fileName': fileName,
      'mimeType': mimeType,
    });
    if (uri == null || uri.isEmpty) {
      throw PlatformException(
        code: 'save_failed',
        message: 'The download could not be saved.',
      );
    }
    return uri;
  }

  /// Whether [uri] can be handed to an external viewer. MediaStore
  /// (`content://`) URIs can; raw `file://` paths from older devices cannot be
  /// shared to other apps without a FileProvider, so those return false.
  static bool canOpen(String uri) => uri.startsWith('content://');

  /// Opens a saved download in an external app. Returns false when the URI is
  /// not shareable or nothing can handle it.
  static Future<bool> openDownloaded(
    String uri, {
    String mimeType = 'application/octet-stream',
  }) async {
    if (!Platform.isAndroid || !canOpen(uri)) return false;
    final ok = await _channel.invokeMethod<bool>('openDownloaded', {
      'uri': uri,
      'mimeType': mimeType,
    });
    return ok ?? false;
  }
}
