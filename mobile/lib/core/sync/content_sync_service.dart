import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/app_config.dart';
import '../../core/providers/auth_controller.dart';
import '../../features/announcements/announcement_providers.dart';
import '../../features/books/books_providers.dart';
import '../../features/home/home_providers.dart';
import '../../features/mock_tests/mock_tests_providers.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/quizzes/quizzes_providers.dart';
import '../../features/shell/library_providers.dart';
import '../network/api_client.dart';
import '../providers/app_providers.dart';
import '../providers/connectivity_provider.dart';

final contentSyncServiceProvider = Provider<ContentSyncService>((ref) {
  final service = ContentSyncService(
    apiClient: ref.watch(apiClientProvider),
    ref: ref,
  );
  ref.onDispose(service.dispose);
  return service;
});

/// Automatic content synchronization service.
///
/// Keeps content up-to-date across all core modules (Tests, Books, PDFs, Videos,
/// Announcements) without requiring manual refresh or app restarts:
///
/// 1. Connects to real-time WebSocket / Socket.IO broadcast gateway for instant
///    sub-second push notifications (e.g. when an admin creates or updates a
///    Live Mock Test).
/// 2. Runs a lightweight background poller (every 10s) while the app is active
///    in the foreground as a fail-safe fallback.
/// 3. Performs targeted invalidation: only invalidates providers for domains
///    whose revision hash changed or whose real-time event fired.
/// 4. Pauses polling & disconnects socket when the app is backgrounded or offline
///    to conserve battery and data.
/// 5. Revalidates immediately when the app resumes or when the student switches
///    or returns to Home, Library, Quizzes, or Books tabs.
class ContentSyncService with WidgetsBindingObserver {
  ContentSyncService({
    required ApiClient apiClient,
    required Ref ref,
    Duration pollInterval = const Duration(seconds: 10),
    Duration tabStaleThreshold = const Duration(seconds: 45),
    bool enableSocket = true,
  })  : _api = apiClient,
        _ref = ref,
        _pollInterval = pollInterval,
        _tabStaleThreshold = tabStaleThreshold,
        _enableSocket = enableSocket;

  final ApiClient _api;
  final Ref _ref;
  final Duration _pollInterval;
  final Duration _tabStaleThreshold;
  final bool _enableSocket;

  Timer? _pollingTimer;
  io.Socket? _socket;
  ProviderSubscription? _authSubscription;
  bool _isSyncing = false;
  bool _isStarted = false;
  bool _isForeground = true;

  /// Cached revision tokens from server: { domain: "timestamp:count" }
  final Map<String, String> _lastRevisions = {};

  /// Timestamp of last refresh per tab index (0: Home, 1: Books, 2: Quizzes, 3: Library)
  final Map<int, DateTime> _tabLastRefreshed = {};

  /// Broadcast stream emitting the name of any content domain invalidated by sync.
  final StreamController<String> _onInvalidated =
      StreamController<String>.broadcast(sync: true);
  Stream<String> get onInvalidated => _onInvalidated.stream;

  void start() {
    if (_isStarted) return;
    _isStarted = true;
    WidgetsBinding.instance.addObserver(this);
    _connectSocket();
    _restartTimer();

    if (_enableSocket) {
      _authSubscription =
          _ref.listen<AuthState>(authControllerProvider, (prev, next) {
        if (prev?.isAuthenticated != next.isAuthenticated && _isForeground) {
          _disconnectSocket();
          unawaited(_connectSocket());
        }
      });
    }

    // Fire first sync after initial frame
    unawaited(syncNow());
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopTimer();
    _disconnectSocket();
    _authSubscription?.close();
    _authSubscription = null;
    if (!_onInvalidated.isClosed) _onInvalidated.close();
    _isStarted = false;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _isForeground = true;
      unawaited(_connectSocket());
      _restartTimer();
      unawaited(syncNow());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _isForeground = false;
      _stopTimer();
      _disconnectSocket();
    }
  }

  Future<void> _connectSocket() async {
    if (!_enableSocket) return;
    if (_socket != null) return;
    if (!_isForeground) return;

    try {
      final token = _ref.read(tokenStoreProvider).accessToken;
      _socket = io.io(
        AppConfig.socketUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .setAuth(token != null && token.isNotEmpty ? {'token': token} : {})
            .enableReconnection()
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(5000)
            .build(),
      );

      _socket?.on('connect', (_) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time socket connected');
      });

      _socket?.on('mockTestCreated', (data) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time mockTestCreated received');
        _invalidateDomain('mockTests');
      });

      _socket?.on('mockTestUpdated', (data) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time mockTestUpdated received');
        _invalidateDomain('mockTests');
      });

      _socket?.on('mockTestDeleted', (data) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time mockTestDeleted received');
        _invalidateDomain('mockTests');
      });

      _socket?.on('contentSync', (data) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time contentSync received: $data');
        if (data is Map && data['domain'] is String) {
          _invalidateDomain(data['domain'] as String);
        } else {
          unawaited(syncNow());
        }
      });

      _socket?.on('disconnect', (_) {
        if (kDebugMode) debugPrint('ContentSyncService: real-time socket disconnected');
      });
    } catch (e) {
      if (kDebugMode) debugPrint('ContentSyncService: socket error: $e');
    }
  }

  void _disconnectSocket() {
    try {
      _socket?.disconnect();
      _socket?.dispose();
    } catch (_) {}
    _socket = null;
  }

  /// Manually triggers invalidation of a content domain (useful for testing or direct events).
  @visibleForTesting
  void handleRealtimeEvent(String domain) {
    _invalidateDomain(domain);
  }

  void _restartTimer() {
    _stopTimer();
    if (!_isForeground) return;
    _pollingTimer = Timer.periodic(_pollInterval, (_) {
      unawaited(syncNow());
    });
  }

  void _stopTimer() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  /// Triggers a sync when user switches to or returns to a tab.
  void syncOnTabSwitch(int tabIndex) {
    final now = DateTime.now();
    final last = _tabLastRefreshed[tabIndex];
    final isStale = last == null || now.difference(last) > _tabStaleThreshold;

    if (isStale) {
      _tabLastRefreshed[tabIndex] = now;
      _refreshTabProviders(tabIndex);
    }

    // Also run a lightweight revision check in the background
    unawaited(syncNow());
  }

  /// Query GET /sync/status and invalidate providers whose content changed.
  Future<void> syncNow() async {
    if (_isSyncing) return;
    final isOffline = _ref.read(connectivityProvider).valueOrNull == false;
    if (isOffline) return;

    _isSyncing = true;
    try {
      final res = await _api.get<dynamic>('/sync/status');
      if (res is Map<String, dynamic>) {
        final rawRevisions = res['revisions'];
        if (rawRevisions is Map<String, dynamic>) {
          _handleRevisions(rawRevisions);
        }
      }
    } catch (e) {
      // Endpoint may not be reachable or network is intermittent — fail silently
      if (kDebugMode) {
        debugPrint('ContentSyncService: sync check failed: $e');
      }
    } finally {
      _isSyncing = false;
    }
  }

  void _handleRevisions(Map<String, dynamic> newRevisions) {
    final isFirstSync = _lastRevisions.isEmpty;

    for (final entry in newRevisions.entries) {
      final domain = entry.key;
      final newRev = entry.value?.toString() ?? '';
      final oldRev = _lastRevisions[domain];

      if (!isFirstSync && oldRev != null && oldRev != newRev) {
        // Revision changed! Invalidate the relevant providers
        _invalidateDomain(domain);
      }

      _lastRevisions[domain] = newRev;
    }
  }

  void _invalidateDomain(String domain) {
    if (kDebugMode) {
      debugPrint('ContentSyncService: domain "$domain" updated on server. Invalidating providers.');
    }

    if (!_onInvalidated.isClosed) {
      _onInvalidated.add(domain);
    }

    switch (domain) {
      case 'books':
        _ref.invalidate(featuredBooksProvider);
        _ref.invalidate(booksProvider);
        _ref.invalidate(bookCategoriesProvider);
        _tabLastRefreshed[1] = DateTime.now();
        break;

      case 'quizzes':
        _ref.invalidate(premiumQuizzesProvider);
        _ref.invalidate(premiumCarouselQuizzesProvider);
        _ref.invalidate(allQuizFoldersProvider);
        _ref.invalidate(quizTierCountsProvider);
        _ref.invalidate(quizFoldersProvider);
        _ref.invalidate(quizzesProvider);
        _tabLastRefreshed[2] = DateTime.now();
        break;

      case 'mockTests':
        _ref.invalidate(liveMockTestsProvider);
        _ref.invalidate(allMockTestsProvider);
        _ref.invalidate(mockTestsViewProvider);
        _ref.invalidate(premiumQuizzesProvider);
        _ref.invalidate(quizzesProvider);
        _tabLastRefreshed[0] = DateTime.now();
        break;

      case 'videos':
        _ref.invalidate(videoExamsProvider);
        _ref.invalidate(videoFolderContentProvider);
        _ref.invalidate(videoChaptersProvider);
        _ref.invalidate(chapterVideosProvider);
        _tabLastRefreshed[3] = DateTime.now();
        break;

      case 'pdfs':
        _ref.invalidate(pdfExamsProvider);
        _ref.invalidate(pdfFolderContentProvider);
        _ref.invalidate(pdfChaptersProvider);
        _ref.invalidate(chapterDocumentsProvider);
        _tabLastRefreshed[3] = DateTime.now();
        break;

      case 'announcements':
        _ref.invalidate(activeAnnouncementsProvider);
        _ref.invalidate(notificationsProvider);
        _tabLastRefreshed[0] = DateTime.now();
        break;
    }
  }

  void _refreshTabProviders(int tabIndex) {
    if (!_onInvalidated.isClosed) {
      _onInvalidated.add('tab:$tabIndex');
    }

    switch (tabIndex) {
      case 0: // Home
        _ref.invalidate(featuredBooksProvider);
        _ref.invalidate(premiumQuizzesProvider);
        _ref.invalidate(liveMockTestsProvider);
        _ref.invalidate(activeAnnouncementsProvider);
        break;

      case 1: // Books
        _ref.invalidate(booksProvider);
        break;

      case 2: // Quizzes
        _ref.invalidate(allQuizFoldersProvider);
        _ref.invalidate(quizTierCountsProvider);
        _ref.invalidate(quizzesProvider);
        break;

      case 3: // Library
        _ref.invalidate(videoExamsProvider);
        _ref.invalidate(pdfExamsProvider);
        break;
    }
  }
}
