
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the device currently has a network interface up.
///
/// This reports the *interface*, not reachability — a captive portal or a dead
/// DNS server still counts as connected. It is therefore used only to decide
/// when to steer a student towards their downloads, never to decide whether an
/// offline lease is still valid; that stays with the server's own answer.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();

  bool isOnline(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);

  yield isOnline(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(isOnline);
});
