import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../storage/token_store.dart';
import '../../data/models/social_links.dart';
import '../../data/repositories/app_update_repository.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/books_repository.dart';
import '../../data/repositories/chat_repository.dart';
import '../../data/repositories/dashboard_repository.dart';
import '../../data/repositories/library_repository.dart';
import '../../data/repositories/mock_tests_repository.dart';
import '../../data/repositories/notifications_repository.dart';
import '../../data/repositories/orders_repository.dart';
import '../../data/repositories/pdf_highlights_repository.dart';
import '../../data/repositories/quizzes_repository.dart';
import '../../data/repositories/social_links_repository.dart';

/// Overridden in `main()` once the plugin has initialised, so every read is
/// synchronous from then on.
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider must be overridden'),
);

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(tokenStore: ref.watch(tokenStoreProvider));
  ref.onDispose(client.dispose);
  return client;
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
  ),
);

final booksRepositoryProvider =
    Provider<BooksRepository>((ref) => BooksRepository(ref.watch(apiClientProvider)));

final quizzesRepositoryProvider = Provider<QuizzesRepository>(
    (ref) => QuizzesRepository(ref.watch(apiClientProvider)));

final libraryRepositoryProvider = Provider<LibraryRepository>(
    (ref) => LibraryRepository(ref.watch(apiClientProvider)));

final dashboardRepositoryProvider = Provider<DashboardRepository>(
    (ref) => DashboardRepository(ref.watch(apiClientProvider)));

final mockTestsRepositoryProvider = Provider<MockTestsRepository>(
    (ref) => MockTestsRepository(ref.watch(apiClientProvider)));

final ordersRepositoryProvider = Provider<OrdersRepository>(
    (ref) => OrdersRepository(ref.watch(apiClientProvider)));

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
    (ref) => NotificationsRepository(ref.watch(apiClientProvider)));

final pdfHighlightsRepositoryProvider = Provider<PdfHighlightsRepository>(
    (ref) => PdfHighlightsRepository(ref.watch(apiClientProvider)));

final chatRepositoryProvider =
    Provider<ChatRepository>((ref) => ChatRepository(ref.watch(apiClientProvider)));

final appUpdateRepositoryProvider = Provider<AppUpdateRepository>(
    (ref) => AppUpdateRepository(ref.watch(apiClientProvider)));

final socialLinksRepositoryProvider = Provider<SocialLinksRepository>(
    (ref) => SocialLinksRepository(ref.watch(apiClientProvider)));

final socialLinksProvider = FutureProvider<SocialLinks>((ref) async {
  final repo = ref.watch(socialLinksRepositoryProvider);
  return repo.fetchSocialLinks();
});

