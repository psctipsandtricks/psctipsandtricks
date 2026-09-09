import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/community/community_providers.dart';
import '../../features/pdfs/annotations/pdf_highlight_store.dart';
import '../../features/offline/offline_providers.dart';
import 'app_providers.dart';

/// Every repository whose responses are scoped to the signed-in student.
///
/// Invalidating one tears down the provider and cascades to every data provider
/// that `watch`es it, so a single pass here drops all cached catalog, order,
/// dashboard, library, quiz, mock-test, notification and chat data without
/// naming each downstream provider. `authRepositoryProvider` is deliberately
/// absent — it holds no cache, and `apiClientProvider` must stay stable so the
/// auth controller's session-expiry subscription survives.
final _accountScopedRepositories = <ProviderOrFamily>[
  booksRepositoryProvider,
  quizzesRepositoryProvider,
  libraryRepositoryProvider,
  dashboardRepositoryProvider,
  mockTestsRepositoryProvider,
  ordersRepositoryProvider,
  notificationsRepositoryProvider,
  chatRepositoryProvider,
];

/// Wipes everything tied to the account that is signing out (or being switched
/// away from): the offline library on disk and in memory, and every cached API
/// response. The session tokens themselves are cleared by
/// `AuthRepository.logout`; this covers what would otherwise outlive them.
///
/// Without this, signing out and into a different account on the same device
/// leaves the previous student's downloaded books openable offline and their
/// purchased-state cards on screen until a manual refresh.
Future<void> clearAccountScopedState(Ref ref) async {
  // 1. Downloaded books: encrypted on disk under a book-id-only name, with no
  //    per-user scoping, so the whole vault has to go.
  try {
    await ref.read(downloadManagerProvider.notifier).wipe();
  } catch (e) {
    if (kDebugMode) {
      debugPrint('Could not wipe offline library on account switch: $e');
    }
  }

  // 2. Cached API data: recreate the repositories so no provider keeps serving
  //    the previous account's catalog, orders, progress or access verdicts.
  for (final repository in _accountScopedRepositories) {
    ref.invalidate(repository);
  }

  // 3. Community chat written to disk: group membership, unread counts and the
  //    conversations themselves all belong to the account signing out, and
  //    unlike the in-memory caches above they would survive a restart.
  try {
    await ref.read(chatCacheProvider).clear();
    ref.invalidate(cachedChatGroupsProvider);
  } catch (e) {
    if (kDebugMode) {
      debugPrint('Could not clear community chat cache on account switch: $e');
    }
  }

  // 4. Marker highlights on book PDFs. Already filed per user, so the next
  //    account could not read them — but they are personal notes on paid
  //    material, and leaving them on a shared device outlives the session that
  //    made them.
  try {
    await PdfHighlightStore().clear();
  } catch (e) {
    if (kDebugMode) {
      debugPrint('Could not clear PDF highlights on account switch: $e');
    }
  }
}
