
import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Checks if the device can actually reach the internet via fast socket/DNS probes.
Future<bool> _probeInternet({Duration timeout = const Duration(milliseconds: 2000)}) async {
  // Fast socket probe on DNS port 53 against primary public DNS resolvers
  const targets = [
    (address: '1.1.1.1', port: 53),
    (address: '8.8.8.8', port: 53),
  ];

  for (final target in targets) {
    try {
      final socket = await Socket.connect(
        target.address,
        target.port,
        timeout: timeout,
      );
      socket.destroy();
      return true;
    } catch (_) {
      // Continue to next probe
    }
  }

  // Fallback: DNS lookups
  for (final host in const ['google.com', 'cloudflare.com']) {
    try {
      final lookup = await InternetAddress.lookup(host).timeout(timeout);
      if (lookup.isNotEmpty && lookup[0].rawAddress.isNotEmpty) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

/// Whether the device currently has an active, working internet connection.
///
/// Combines network interface detection with actual internet reachability check
/// so captive portals, disconnected Wi-Fi, and airplane mode are detected accurately.
///
/// Includes app lifecycle awareness and consecutive failure debouncing to prevent
/// spurious "offline" alerts when the app is minimized and resumed.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();

  bool isAppForeground() {
    final state = WidgetsBinding.instance.lifecycleState;
    return state == null || state == AppLifecycleState.resumed;
  }

  Future<bool> checkReachability(List<ConnectivityResult> results) async {
    final hasInterface = results.any((r) => r != ConnectivityResult.none);
    if (!hasInterface) return false;

    if (await _probeInternet()) return true;

    // Retry once after a brief delay if initial probe failed but interface exists
    // (handles radio wake-up latency when resuming or switching networks)
    await Future.delayed(const Duration(milliseconds: 1000));
    return await _probeInternet(timeout: const Duration(milliseconds: 2500));
  }

  // Initial check
  final initialResults = await connectivity.checkConnectivity();
  var currentOnline = await checkReachability(initialResults);
  yield currentOnline;

  final controller = StreamController<List<ConnectivityResult>>();
  final sub = connectivity.onConnectivityChanged.listen((results) {
    if (!controller.isClosed) controller.add(results);
  });

  // App lifecycle observer: re-check connectivity cleanly upon app resume
  final observer = _AppLifecycleConnectivityObserver(() async {
    if (controller.isClosed) return;
    // Allow OS network sockets to stabilize after app resume
    await Future.delayed(const Duration(milliseconds: 300));
    if (controller.isClosed) return;
    try {
      final results = await connectivity.checkConnectivity();
      if (!controller.isClosed) controller.add(results);
    } catch (_) {}
  });
  WidgetsBinding.instance.addObserver(observer);

  // Periodic health check (every 15 seconds while in foreground)
  final timer = Timer.periodic(const Duration(seconds: 15), (_) async {
    if (controller.isClosed) return;
    if (!isAppForeground()) return;
    try {
      final results = await connectivity.checkConnectivity();
      if (!controller.isClosed) controller.add(results);
    } catch (_) {}
  });

  ref.onDispose(() {
    WidgetsBinding.instance.removeObserver(observer);
    sub.cancel();
    timer.cancel();
    controller.close();
  });

  int consecutiveFailures = 0;

  await for (final results in controller.stream) {
    // Skip evaluating state while the app is in background/paused
    if (!isAppForeground()) continue;

    final hasInterface = results.any((r) => r != ConnectivityResult.none);
    bool nextOnline;

    if (!hasInterface) {
      // Explicitly disconnected interface (e.g. Airplane mode, Wi-Fi & data turned off)
      nextOnline = false;
      consecutiveFailures = 2;
    } else {
      final reachable = await checkReachability(results);
      if (reachable) {
        consecutiveFailures = 0;
        nextOnline = true;
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= 2) {
          nextOnline = false;
        } else {
          // Keep current state while awaiting confirmation
          nextOnline = currentOnline;
        }
      }
    }

    if (nextOnline != currentOnline) {
      currentOnline = nextOnline;
      yield nextOnline;
    }
  }
});

class _AppLifecycleConnectivityObserver extends WidgetsBindingObserver {
  _AppLifecycleConnectivityObserver(this.onResume);
  final VoidCallback onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      onResume();
    }
  }
}



