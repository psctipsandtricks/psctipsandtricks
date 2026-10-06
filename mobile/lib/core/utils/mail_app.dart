import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Opens the phone's mail app on its inbox — Gmail when installed, otherwise
/// the default mail app. Android only; returns false anywhere it can't.
class MailApp {
  const MailApp._();

  // Must match `MAIL_CHANNEL` in MainActivity.kt.
  static const MethodChannel _channel = MethodChannel('psc/mail');

  static Future<bool> openInbox() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return false;
    try {
      return await _channel.invokeMethod<bool>('openInbox') ?? false;
    } catch (e) {
      if (kDebugMode) debugPrint('Could not open mail app: $e');
      return false;
    }
  }
}
