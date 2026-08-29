import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_controller.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/oauth_callback_screen.dart';
import '../../features/auth/signup_screen.dart';
import '../../features/books/book_detail_screen.dart';
import '../../features/books/book_reader_screen.dart';
import '../../features/books/books_screen.dart';
import '../../features/community/community_screen.dart';
import '../../features/community/group_chat_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/mock_tests/mock_test_detail_screen.dart';
import '../../features/mock_tests/mock_tests_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/offline/downloads_screen.dart';
import '../../features/orders/orders_screen.dart';
import '../../features/pdfs/pdf_documents_screen.dart';
import '../../features/profile/account_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/quizzes/quiz_attempt_screen.dart';
import '../../features/quizzes/quiz_history_screen.dart';
import '../../features/quizzes/quizzes_screen.dart';
import '../../features/shell/library_screen.dart';
import '../../features/shell/shell_scaffold.dart';
import '../../features/videos/video_list_screen.dart';

class AppRoutes {
  const AppRoutes._();

  static const home = '/';
  static const login = '/login';
  static const signup = '/signup';
  static const oauthCallback = '/auth/callback';
  static const books = '/books';
  static const quizzes = '/quizzes';
  static const quizHistory = '/quizzes/history';
  static const library = '/library';
  static const libraryVideos = '/library?tab=videos';
  static const libraryPdfs = '/library?tab=pdfs';
  static const account = '/account';
  static const dashboard = '/dashboard';
  static const profile = '/profile';
  static const orders = '/orders';
  static const notifications = '/notifications';
  static const community = '/community';
  static const mockTests = '/mock-tests';
  static const downloads = '/books/downloads';

  static String bookDetail(String id) => '/books/$id';
  static String bookReader(String id, {bool resume = false}) =>
      '/books/$id/read${resume ? '?resume=1' : ''}';
  static String quizAttempt(String id) => '/attempt/$id';
  static String mockTest(String id) => '/mock-tests/$id';
  static String groupChat(String id) => '/community/$id';
}

/// Screens a signed-out student may not reach. Everything else — the catalog,
/// quiz listings, the video and PDF libraries — is browsable as a guest, the
/// same as on the website.
const _protectedPrefixes = <String>[
  '/books/downloads',
  '/dashboard',
  '/profile',
  '/orders',
  '/notifications',
  '/community',
  '/quizzes/history',
];

bool _isProtected(String location) {
  if (_protectedPrefixes.any(location.startsWith)) return true;
  // Reading a book and attempting a quiz both require a session.
  if (RegExp(r'^/books/[^/]+/read').hasMatch(location)) return true;
  if (location.startsWith('/attempt/')) return true;
  if (RegExp(r'^/mock-tests/[^/]+$').hasMatch(location)) return true;
  return false;
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  // Re-evaluate redirects the moment the session changes, so a sign-out from
  // any screen bounces protected routes immediately.
  final refresh = _AuthRefreshListenable(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.home,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      // Hold every decision until the stored session has been read from disk,
      // otherwise a cold start flashes the login screen at a signed-in student.
      if (auth.isResolving) return null;

      final location = state.matchedLocation;
      final onAuthScreen = location == AppRoutes.login ||
          location == AppRoutes.signup ||
          location == AppRoutes.oauthCallback;

      if (!auth.isAuthenticated && _isProtected(location)) {
        return '${AppRoutes.login}?redirect=${Uri.encodeComponent(state.uri.toString())}';
      }
      if (auth.isAuthenticated && onAuthScreen) {
        return state.uri.queryParameters['redirect'] ?? AppRoutes.home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) =>
            LoginScreen(redirect: state.uri.queryParameters['redirect']),
      ),
      GoRoute(
        path: AppRoutes.signup,
        builder: (context, state) =>
            SignupScreen(redirect: state.uri.queryParameters['redirect']),
      ),
      GoRoute(
        path: AppRoutes.oauthCallback,
        builder: (context, state) => OAuthCallbackScreen(
          accessToken: state.uri.queryParameters['accessToken'],
          refreshToken: state.uri.queryParameters['refreshToken'],
          redirect: state.uri.queryParameters['redirect'],
        ),
      ),

      // Full-screen experiences that intentionally sit above the tab bar.
      GoRoute(
        path: '/books/:id/read',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => BookReaderScreen(
          bookId: state.pathParameters['id']!,
          autoResume: state.uri.queryParameters['resume'] == '1',
        ),
      ),
      GoRoute(
        path: '/attempt/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) =>
            QuizAttemptScreen(quizId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/mock-tests/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) =>
            MockTestDetailScreen(mockTestId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/community/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) =>
            GroupChatScreen(groupId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const OrdersScreen(),
      ),
      GoRoute(
        path: '/profile',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const ProfileScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ShellScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
                routes: [
                  GoRoute(
                    path: 'notifications',
                    builder: (context, state) => const NotificationsScreen(),
                  ),
                  GoRoute(
                    path: 'mock-tests',
                    builder: (context, state) => const MockTestsScreen(),
                  ),
                  GoRoute(
                    path: 'dashboard',
                    builder: (context, state) => const DashboardScreen(),
                  ),
                  GoRoute(
                    path: 'community',
                    builder: (context, state) => const CommunityScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.books,
                builder: (context, state) => const BooksScreen(),
                routes: [
                  // Declared ahead of ':id' so the literal segment wins.
                  GoRoute(
                    path: 'downloads',
                    builder: (context, state) => const DownloadsScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (context, state) =>
                        BookDetailScreen(bookId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.quizzes,
                builder: (context, state) => const QuizzesScreen(),
                routes: [
                  GoRoute(
                    path: 'history',
                    builder: (context, state) => const QuizHistoryScreen(),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.library,
                builder: (context, state) {
                  final tabParam = state.uri.queryParameters['tab'];
                  final initialIndex = switch (tabParam?.toLowerCase()) {
                    'videos' || 'video' || '1' => 1,
                    'pdfs' || 'pdf' || '2' => 2,
                    _ => 0,
                  };
                  return LibraryScreen(
                    key: ValueKey(initialIndex),
                    initialIndex: initialIndex,
                  );
                },
                routes: [
                  GoRoute(
                    path: 'videos/:examId',
                    builder: (context, state) => VideoListScreen(
                      examId: state.pathParameters['examId']!,
                      examTitle: state.uri.queryParameters['title'] ?? 'Videos',
                    ),
                  ),
                  GoRoute(
                    path: 'pdfs/:examId',
                    builder: (context, state) => PdfDocumentsScreen(
                      examId: state.pathParameters['examId']!,
                      examTitle: state.uri.queryParameters['title'] ?? 'PDFs',
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.account,
                builder: (context, state) => const AccountScreen(),
                routes: [
                  GoRoute(
                    path: 'profile',
                    builder: (context, state) => const ProfileScreen(),
                  ),
                  GoRoute(
                    path: 'orders',
                    builder: (context, state) => const OrdersScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.explore_off_rounded, size: 44),
              const SizedBox(height: 12),
              Text(
                'That page does not exist.',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go(AppRoutes.home),
                child: const Text('Back to home'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
});

/// Bridges the Riverpod auth state onto the Listenable go_router expects.
class _AuthRefreshListenable extends ChangeNotifier {
  _AuthRefreshListenable(Ref ref) {
    _sub = ref.listen<AuthState>(
      authControllerProvider,
      (_, __) => notifyListeners(),
      fireImmediately: false,
    );
  }

  late final ProviderSubscription<AuthState> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
