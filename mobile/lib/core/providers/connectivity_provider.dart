
import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the device currently has an active, working internet connection.
///
/// Combines network interface detection with actual internet reachability check
/// so captive portals, disconnected Wi-Fi, and airplane mode are detected accurately.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();

  Future<bool> checkReachability(List<ConnectivityResult> results) async {
    final hasInterface = results.any((r) => r != ConnectivityResult.none);
    if (!hasInterface) return false;

    try {
      final socket = await Socket.connect(
        '8.8.8.8',
        53,
        timeout: const Duration(milliseconds: 1500),
      );
      socket.destroy();
      return true;
    } catch (_) {
      try {
        final lookup = await InternetAddress.lookup('google.com')
            .timeout(const Duration(milliseconds: 1500));
        return lookup.isNotEmpty && lookup[0].rawAddress.isNotEmpty;
      } catch (_) {
        return false;
      }
    }
  }

  // Initial check
  final initialResults = await connectivity.checkConnectivity();
  var currentOnline = await checkReachability(initialResults);
  yield currentOnline;

  final controller = StreamController<List<ConnectivityResult>>();
  final sub = connectivity.onConnectivityChanged.listen((results) {
    if (!controller.isClosed) controller.add(results);
  });
  final timer = Timer.periodic(const Duration(seconds: 2), (_) async {
    if (controller.isClosed) return;
    try {
      final results = await connectivity.checkConnectivity();
      if (!controller.isClosed) controller.add(results);
    } catch (_) {}
  });


  ref.onDispose(() {
    sub.cancel();
    timer.cancel();
    controller.close();
  });

  await for (final results in controller.stream) {
    final nextOnline = await checkReachability(results);
    if (nextOnline != currentOnline) {
      currentOnline = nextOnline;
      yield nextOnline;
    }
  }
});


