import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';
import '../books/books_providers.dart';
import '../home/home_providers.dart';
import '../quizzes/quizzes_providers.dart';
import 'offline_providers.dart';


/// Full-screen tasks that must never be interrupted by an auto-navigation.
const _uninterruptible = <String>['/attempt/', '/read', '/pdfs/'];

/// Where a launch that found no connection should open, or null to stay put.
///
/// Fires even with an empty library: "you're offline, nothing is saved here" is
/// a straight answer, and it beats a home screen that only fails to load.
@visibleForTesting
String? offlineLaunchDestination({
  required bool signedIn,
  required String location,
}) {
  // A guest has nothing in the vault, and the downloads route is behind the
  // session anyway — the router would bounce it to the login screen.
  if (!signedIn) return null;
  // A launch routed somewhere specific — a notification tap, a deep link — is
  // the student's own destination, not ours to override.
  if (location != AppRoutes.home) return null;
  return AppRoutes.downloads;
}

/// Whether losing the connection mid-session should move the student.
@visibleForTesting
bool shouldSteerToDownloads({
  required bool signedIn,
  required bool hasDownloads,
  required String location,
}) {
  if (!signedIn) return false;
  if (location.startsWith(AppRoutes.downloads)) return false;
  if (_uninterruptible.any(location.contains)) return false;
  return true;
}


/// Steers a student to their downloads when there is no network.
///
/// Two situations, handled differently:
///
///  * **Cold start with no connection.** Every screen the app could open on
///    needs the network, so the student would otherwise be looking at a wall of
///    retry buttons. Their downloads are the one thing that works, so that is
///    where the app opens — replacing the stack rather than pushing onto it, as
///    there is nothing behind it worth going back to.
///  * **Losing the connection while using the app.** Deliberately conservative:
///    only on the online → offline transition, never repeatedly while offline,
///    so a student who navigates away is not dragged back, and never out of the
///    reader, a quiz attempt or the PDF viewer — yanking someone out of a paper
///    they are sitting mid-question would be worse than the connection loss
///    itself.
class OfflineGate extends ConsumerStatefulWidget {
  const OfflineGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<OfflineGate> createState() => _OfflineGateState();
}

class _OfflineGateState extends ConsumerState<OfflineGate> {
  bool? _wasOnline;
  bool _steeredOffline = false;

  /// Set the moment the launch path starts, so it can never run twice — it
  /// awaits the session and the vault, and a second reading landing in the
  /// meantime must not start it again.
  bool _launchHandled = false;


  /// Long enough to cover reading the stored session back off disk on a slow
  /// device, short enough that a session which never resolves does not leave
  /// the student parked on a broken home screen forever.
  static const _sessionWait = Duration(seconds: 8);

  @override
  void initState() {
    super.initState();
    unawaited(_readLaunchConnectivity());
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(connectivityProvider, (_, next) {
      final isOnline = next.valueOrNull;
      if (isOnline == null) return;
      _onConnectivity(isOnline);
    });

    return widget.child;
  }

  /// The state of the network as the app launched.
  ///
  /// Read explicitly rather than waited for through the listener above: the
  /// listener only hears about changes, and an app that started with the
  /// connection already down has no change to report.
  Future<void> _readLaunchConnectivity() async {
    try {
      final isOnline = await ref.read(connectivityProvider.future);
      if (mounted) _onConnectivity(isOnline);
    } catch (_) {
      // A platform that will not answer is treated as online: the app then
      // behaves exactly as it did before any of this existed.
    }
  }

  void _onConnectivity(bool isOnline) {
    final wasOnline = _wasOnline;
    _wasOnline = isOnline;

    // The first reading of the session says how the app is starting.
    if (wasOnline == null) {
      if (!isOnline) {
        unawaited(_openOfflineOnLaunch());
      }
      return;
    }

    // Transition: Online -> Offline
    if (!isOnline && wasOnline) {
      _showOfflineNotification();
      _steerToDownloads();
      return;
    }

    // Transition: Offline -> Online
    if (isOnline && !wasOnline) {
      _showOnlineNotification();
      // Invalidate queries so that failed offline queries reload fresh data
      ref.invalidate(booksProvider);
      ref.invalidate(featuredBooksProvider);
      ref.invalidate(quizzesProvider);
      // Re-check licenses and updates upon restoring connection
      ref.read(downloadManagerProvider.notifier).revalidateStale();
      _restoreOnlineNavigation();
    }
  }


  void _restoreOnlineNavigation() {
    if (!mounted) return;
    final router = ref.read(routerProvider);
    final location = router.routerDelegate.currentConfiguration.uri.toString();

    // If the student was pushed to or opened on the Downloads screen due to offline mode,
    // seamlessly restore the normal online screen (pop back if pushed, or go to Home if not).
    if (location.startsWith(AppRoutes.downloads) || _steeredOffline) {
      _steeredOffline = false;
      if (router.canPop()) {
        router.pop();
      } else {
        router.go(AppRoutes.home);
      }
    }
  }



  void _showOfflineNotification() {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: const Color(0xFFEF4444).withValues(alpha: 0.6),
            width: 1.2,
          ),
        ),
        content: const Row(
          children: [
            Icon(Icons.wifi_off_rounded, color: Color(0xFFEF4444), size: 22),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'You are offline.',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Only downloaded books are available.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  void _showOnlineNotification() {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: const Color(0xFF10B981).withValues(alpha: 0.6),
            width: 1.2,
          ),
        ),
        content: const Row(
          children: [
            Icon(Icons.wifi_rounded, color: Color(0xFF10B981), size: 22),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'You are online.',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'All modules and features are restored.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// Launch path: wait for the two things that decide what the student can be
  /// shown — the restored session and the vault — then open the downloads.
  Future<void> _openOfflineOnLaunch() async {
    if (_launchHandled) return;
    _launchHandled = true;

    final signedIn = await _awaitSignedIn();
    if (!mounted) return;
    await ref.read(downloadManagerProvider.notifier).ready;
    if (!mounted) return;

    if (ref.read(connectivityProvider).valueOrNull != false) return;

    final router = ref.read(routerProvider);
    final destination = offlineLaunchDestination(
      signedIn: signedIn,
      location: router.routerDelegate.currentConfiguration.uri.toString(),
    );
    if (destination == null) return;

    router.go(destination);
    _showOfflineNotification();
  }

  /// Resolves once the stored session has been read back, to whether a student
  /// is signed in. Navigating before this would be bounced straight to the
  /// login screen by the router's own redirect.
  Future<bool> _awaitSignedIn() async {
    final current = ref.read(authControllerProvider);
    if (!current.isResolving) return current.isAuthenticated;

    final resolved = Completer<bool>();
    final sub = ref.listenManual<AuthState>(authControllerProvider, (_, next) {
      if (next.isResolving || resolved.isCompleted) return;
      resolved.complete(next.isAuthenticated);
    });
    try {
      return await resolved.future
          .timeout(_sessionWait, onTimeout: () => false);
    } finally {
      sub.close();
    }
  }

  void _steerToDownloads() {
    if (!mounted) return;

    final router = ref.read(routerProvider);
    final location = router.routerDelegate.currentConfiguration.uri.toString();
    final steer = shouldSteerToDownloads(
      signedIn: ref.read(authControllerProvider).isAuthenticated,
      hasDownloads: ref.read(offlineLibraryProvider).isNotEmpty,
      location: location,
    );
    if (!steer) return;

    _steeredOffline = true;
    router.push(AppRoutes.downloads);
  }
}

