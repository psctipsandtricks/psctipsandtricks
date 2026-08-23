import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// The token pair a completed OAuth round trip hands back.
class OAuthTokens {
  const OAuthTokens(this.accessToken, this.refreshToken);
  final String accessToken;
  final String refreshToken;
}

/// Runs Google or Apple sign-in inside an in-app browser against the existing
/// backend — the app adds no OAuth client of its own.
///
/// The API finishes the handshake by redirecting to
/// `FRONTEND_URL/auth/callback?redirect=…#accessToken=…&refreshToken=…`. That
/// final hop is intercepted and cancelled here, so the website never has to
/// load (and need not even be reachable from the device); only its URL is read.
class OAuthWebViewScreen extends StatefulWidget {
  const OAuthWebViewScreen({super.key, required this.provider});

  /// `google` or `apple` — matches the `/auth/:provider` route on the API.
  final String provider;

  @override
  State<OAuthWebViewScreen> createState() => _OAuthWebViewScreenState();
}

class _OAuthWebViewScreenState extends State<OAuthWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _error;
  bool _settled = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (_) {},
          onUrlChange: (change) {
            if (change.url != null) _intercept(change.url!);
          },
          onPageStarted: (url) {
            if (_intercept(url)) return;
            if (_remapLocalhost(url)) return;
            if (mounted && !_settled) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted && !_settled) setState(() => _loading = false);
          },
          onNavigationRequest: (request) {
            if (_intercept(request.url)) {
              return NavigationDecision.prevent;
            }
            if (_remapLocalhost(request.url)) {
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onWebResourceError: (error) {
            if (_settled) return;
            if (error.url != null && _intercept(error.url!)) return;
            // Sub-resource failures (a tracking pixel, a font) are not the
            // sign-in failing — only report when the page itself could not load.
            if (!error.isForMainFrame!) return;
            if (mounted && !_settled) {
              setState(() {
                _loading = false;
                _error = 'Could not reach the sign-in page. Check your connection.';
              });
            }
          },
        ),
      )
      ..loadRequest(
        Uri.parse('${AppConfig.apiBaseUrl}/auth/${widget.provider}'),
      );
  }

  /// Remaps localhost/127.0.0.1 API callback URLs to [AppConfig.apiBaseUrl]
  /// (e.g. 10.0.2.2:4000 on Android emulator) so the handshake reaches the host backend.
  bool _remapLocalhost(String url) {
    if (_settled) return false;
    final uri = Uri.tryParse(url);
    if (uri == null) return false;

    if ((uri.host == 'localhost' || uri.host == '127.0.0.1') && uri.port == 4000) {
      final apiUri = Uri.parse(AppConfig.apiBaseUrl);
      if (apiUri.host != uri.host || apiUri.port != uri.port) {
        final remappedUri = uri.replace(
          scheme: apiUri.scheme,
          host: apiUri.host,
          port: apiUri.port,
        );
        _controller.loadRequest(remappedUri);
        return true;
      }
    }
    return false;
  }

  /// Returns true when [url] is the backend's final redirect, consuming it.
  bool _intercept(String url) {
    if (_settled) return true;
    final uri = Uri.tryParse(url);
    if (uri == null) return false;

    if (uri.path.contains('/auth/callback')) {
      // Tokens ride in the fragment so they never land in a server log.
      final fragment = Uri.splitQueryString(uri.fragment);
      final access = fragment['accessToken'] ?? uri.queryParameters['accessToken'];
      final refresh =
          fragment['refreshToken'] ?? uri.queryParameters['refreshToken'];

      if (access != null && refresh != null) {
        _settled = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop(OAuthTokens(access, refresh));
        });
        return true;
      }
    }

    // The API bounces back to /login?error=… when the handshake is rejected.
    final error = uri.queryParameters['error'];
    if (error != null && uri.path.contains('/login')) {
      _settled = true;
      setState(() {
        _loading = false;
        _error = _messageFor(error);
      });
      return true;
    }
    return false;
  }

  String _messageFor(String code) {
    switch (code) {
      case 'oauth_failed':
        return 'Sign-in was not completed. Please try again.';
      case 'suspended_staff':
        return 'This account has been suspended.';
      default:
        return 'Sign-in failed. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.provider == 'apple' ? 'Apple' : 'Google';
    return Scaffold(
      appBar: AppBar(
        title: Text('Continue with $label'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _error != null
          ? _ErrorPane(message: _error!)
          : Stack(
              children: [
                WebViewWidget(controller: _controller),
                if (_loading)
                  const LinearProgressIndicator(minHeight: 2.5),
              ],
            ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  const _ErrorPane({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.rose, size: 34),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: context.palette.textSecondary, height: 1.45),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Back to sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
