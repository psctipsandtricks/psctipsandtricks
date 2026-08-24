import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/offline/offline_vault.dart';
import '../../core/providers/app_providers.dart';
import '../../data/models/offline.dart';
import '../../data/repositories/offline_repository.dart';
import 'download_manager.dart';

final offlineVaultProvider = Provider<OfflineVault>((ref) => OfflineVault());

final offlineRepositoryProvider = Provider<OfflineRepository>(
  (ref) => OfflineRepository(
    ref.watch(apiClientProvider),
    ref.watch(offlineVaultProvider),
  ),
);

/// Long-lived on purpose: a transfer must survive the student navigating away
/// from the screen that started it.
final downloadManagerProvider =
    StateNotifierProvider<DownloadManager, Map<String, DownloadProgress>>(
  (ref) => DownloadManager(ref.watch(offlineRepositoryProvider)),
);

/// The offline library, rebuilt whenever any transfer or lease changes.
final offlineLibraryProvider = Provider<List<OfflineBook>>((ref) {
  ref.watch(downloadManagerProvider);
  return ref.watch(downloadManagerProvider.notifier).library;
});

/// One book's local copy, or null if it was never downloaded.
final offlineBookProvider =
    Provider.family<OfflineBook?, String>((ref, bookId) {
  ref.watch(downloadManagerProvider);
  return ref.watch(downloadManagerProvider.notifier).bookFor(bookId);
});

/// One book's live download state.
final downloadProgressProvider =
    Provider.family<DownloadProgress, String>((ref, bookId) {
  final all = ref.watch(downloadManagerProvider);
  return all[bookId] ??
      DownloadProgress(bookId: bookId, status: OfflineStatus.none);
});

/// How much space the offline library takes up.
final offlineLibrarySizeProvider = FutureProvider<int>((ref) async {
  final books = ref.watch(offlineLibraryProvider);
  final repo = ref.watch(offlineRepositoryProvider);
  var total = 0;
  for (final book in books) {
    total += await repo.sizeOnDisk(book.bookId);
  }
  return total;
});
