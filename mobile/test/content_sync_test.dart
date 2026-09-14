import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/providers/connectivity_provider.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/sync/content_sync_service.dart';

class _MockApiClient extends ApiClient {
  _MockApiClient() : super(tokenStore: TokenStore());

  Map<String, dynamic>? responseData;
  bool throwError = false;
  int getCount = 0;

  @override
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) async {
    if (path == '/sync/status') {
      getCount++;
      if (throwError) {
        throw DioException(
          requestOptions: RequestOptions(path: path),
          message: 'Server unreachable',
        );
      }
      return (responseData ?? <String, dynamic>{}) as T;
    }
    throw UnimplementedError('Unhandled path $path');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MockApiClient fakeApi;
  late ProviderContainer container;

  setUp(() {
    fakeApi = _MockApiClient();
    container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(fakeApi),
        connectivityProvider.overrideWith((ref) => Stream.value(true)),
        currentUserProvider.overrideWith((ref) => null),
        contentSyncServiceProvider.overrideWith(
          (ref) => ContentSyncService(
            apiClient: ref.watch(apiClientProvider),
            ref: ref,
            enableSocket: false,
          ),
        ),
      ],
    );
  });

  tearDown(() {
    container.dispose();
  });

  test('initial sync records baseline revisions without invalidating', () async {
    fakeApi.responseData = {
      'revisions': {
        'books': '100:5',
        'quizzes': '200:10',
        'mockTests': '300:2',
        'videos': '400:8',
        'pdfs': '500:6',
        'announcements': '600:1',
      },
      'serverTime': 1726360000000,
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    await syncService.syncNow();

    expect(fakeApi.getCount, 1);
    expect(emitted, isEmpty);
  });

  test('detects updated books and emits books invalidation', () async {
    fakeApi.responseData = {
      'revisions': {
        'books': '100:5',
        'quizzes': '200:10',
      },
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    // Initial baseline sync
    await syncService.syncNow();
    expect(emitted, isEmpty);

    // Admin updates a book: revision changes
    fakeApi.responseData = {
      'revisions': {
        'books': '105:5', // updated timestamp
        'quizzes': '200:10', // unchanged
      },
    };

    await syncService.syncNow();

    expect(emitted, ['books']);
  });

  test('detects updated mock tests and emits mockTests invalidation', () async {
    fakeApi.responseData = {
      'revisions': {
        'mockTests': '300:2',
      },
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    await syncService.syncNow();
    expect(emitted, isEmpty);

    // Admin publishes a new mock test
    fakeApi.responseData = {
      'revisions': {
        'mockTests': '310:3',
      },
    };

    await syncService.syncNow();

    expect(emitted, ['mockTests']);
  });

  test('detects updated videos or pdfs and emits library invalidations', () async {
    fakeApi.responseData = {
      'revisions': {
        'videos': '400:8',
        'pdfs': '500:6',
      },
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    await syncService.syncNow();
    expect(emitted, isEmpty);

    // Admin adds a PDF
    fakeApi.responseData = {
      'revisions': {
        'videos': '400:8', // unchanged
        'pdfs': '520:7', // new PDF published
      },
    };

    await syncService.syncNow();

    expect(emitted, ['pdfs']);
  });

  test('detects updated announcements and emits announcements invalidation', () async {
    fakeApi.responseData = {
      'revisions': {
        'announcements': '600:1',
      },
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    await syncService.syncNow();
    expect(emitted, isEmpty);

    // Admin edits popup
    fakeApi.responseData = {
      'revisions': {
        'announcements': '650:1',
      },
    };

    await syncService.syncNow();

    expect(emitted, ['announcements']);
  });

  test('identical revisions cause zero invalidations (avoids redundant work)', () async {
    fakeApi.responseData = {
      'revisions': {
        'books': '100:5',
        'quizzes': '200:10',
      },
    };

    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    await syncService.syncNow();
    expect(emitted, isEmpty);

    // No changes on server
    await syncService.syncNow();

    expect(emitted, isEmpty);
  });

  test('handles network error silently without throwing', () async {
    fakeApi.throwError = true;

    final syncService = container.read(contentSyncServiceProvider);

    // Should complete cleanly without uncaught exception
    await syncService.syncNow();
    expect(fakeApi.getCount, 1);
  });

  test('syncOnTabSwitch refreshes stale tabs immediately', () async {
    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    // Switch to Home (index 0)
    syncService.syncOnTabSwitch(0);
    expect(emitted, contains('tab:0'));

    // Switch to Library (index 3)
    syncService.syncOnTabSwitch(3);
    expect(emitted, contains('tab:3'));
  });

  test('pauses sync when app is paused and resumes when app is resumed', () async {
    fakeApi.responseData = {
      'revisions': {'books': '100:1'},
    };

    final syncService = container.read(contentSyncServiceProvider);
    syncService.start();

    // App goes to background
    syncService.didChangeAppLifecycleState(AppLifecycleState.paused);
    final countAfterPause = fakeApi.getCount;

    await Future<void>.delayed(const Duration(milliseconds: 50));
    // No new calls should happen while paused
    expect(fakeApi.getCount, countAfterPause);

    // App comes back to foreground
    syncService.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await Future<void>.delayed(const Duration(milliseconds: 20));

    expect(fakeApi.getCount, greaterThan(countAfterPause));
  });

  test('real-time mock test event invalidates mockTests providers immediately', () async {
    final syncService = container.read(contentSyncServiceProvider);
    final emitted = <String>[];
    final sub = syncService.onInvalidated.listen(emitted.add);
    addTearDown(sub.cancel);

    syncService.handleRealtimeEvent('mockTests');

    expect(emitted, ['mockTests']);
  });
}
