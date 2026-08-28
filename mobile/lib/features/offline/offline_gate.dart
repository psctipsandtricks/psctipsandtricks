import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';
import 'offline_providers.dart';

/// Steers a student to their downloads when the network drops.
///
/// Deliberately conservative about when it fires:
///
///  * only on the online → offline transition, never repeatedly while offline,
///    so a student who navigates away is not dragged back;
///  * never out of the reader, a quiz attempt or the PDF viewer, since yanking
///    someone out of a paper they are sitting mid-question would be worse than
///    the connection loss itself;
///  * only when they are signed in and actually have something downloaded —
///    sending someone to an empty page helps nobody.
class OfflineGate extends ConsumerStatefulWidget {
  const OfflineGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<OfflineGate> createState() => _OfflineGateState();
}

class _OfflineGateState extends ConsumerState<OfflineGate> {
  bool? _wasOnline;

  /// Full-screen tasks that must never be interrupted by an auto-navigation.
  static const _uninterruptible = <String>['/attempt/', '/read', '/pdfs/'];

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(connectivityProvider, (_, next) {
      final isOnline = next.valueOrNull;
      if (isOnline == null) return;

      final wasOnline = _wasOnline;
      _wasOnline = isOnline;

      // Only act on a genuine transition into offline.
      if (isOnline || wasOnline != true) return;
      _steerToDownloads();
    });

    return widget.child;
  }

  void _steerToDownloads() {
    if (!mounted) return;
    if (!ref.read(authControllerProvider).isAuthenticated) return;

    final downloads = ref.read(offlineLibraryProvider);
    if (downloads.isEmpty) return;

    final router = ref.read(routerProvider);
    final location =
        router.routerDelegate.currentConfiguration.uri.toString();

    if (location.startsWith(AppRoutes.downloads)) return;
    if (_uninterruptible.any(location.contains)) return;

    router.push(AppRoutes.downloads);
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      const SnackBar(
        content: Text("You're offline — here are your downloaded books."),
      ),
    );
  }
}
