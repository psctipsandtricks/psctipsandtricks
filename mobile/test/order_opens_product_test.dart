import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/data/models/order.dart';

/// Every route the app declares at the top level, in declaration order.
List<RouteBase> _topLevelRoutes() {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  final router = container.read(routerProvider);
  addTearDown(router.dispose);
  return router.configuration.routes;
}

int _indexOfPath(List<RouteBase> routes, String path) =>
    routes.indexWhere((r) => r is GoRoute && r.path == path);

GoRoute _routeAt(List<RouteBase> routes, String path) =>
    routes.firstWhere((r) => r is GoRoute && r.path == path) as GoRoute;

Order _order({String? bookId, String? quizId}) => Order(
      id: 'o1',
      amount: 499,
      currency: 'INR',
      status: OrderStatus.success,
      bookId: bookId,
      quizId: quizId,
      bookTitle: bookId == null ? null : 'Kerala History',
      quizTitle: quizId == null ? null : 'Premium Quiz',
    );

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Building the real router builds the real auth controller, which reads
    // the stored session off the keystore. There is no keystore in a test, so
    // the channel answers "nothing stored" and the router comes up signed out.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  group('an order knows which product it bought', () {
    test('a book order carries the book it opens', () {
      final order = _order(bookId: 'b1');
      expect(order.isBook, isTrue);
      expect(AppRoutes.bookDetail(order.bookId!), '/books/b1');
    });

    test('a quiz order carries the quiz it opens', () {
      final order = _order(quizId: 'q1');
      expect(order.isBook, isFalse);
      expect(AppRoutes.quizAttempt(order.quizId!), '/attempt/q1');
    });
  });

  group('both product pages are reachable from My orders', () {
    // My orders sits on the root navigator, outside the tab shell. A route
    // declared inside a StatefulShellBranch is silently scoped out when it is
    // pushed from out there — the location changes and nothing renders, which
    // is what made tapping a book order do nothing. Every page an order can
    // open therefore has to be a root-navigator route.
    test('My orders is itself a root-level page', () {
      final routes = _topLevelRoutes();
      expect(_routeAt(routes, AppRoutes.orders).parentNavigatorKey, isNotNull);
    });

    test('book detail is a root-level page', () {
      final routes = _topLevelRoutes();
      final bookDetail = _routeAt(routes, '/books/:id');
      expect(
        bookDetail.parentNavigatorKey,
        isNotNull,
        reason: 'book detail nested in the Books branch opens nothing from '
            'My orders',
      );
    });

    test('the quiz page is a root-level page', () {
      final routes = _topLevelRoutes();
      expect(_routeAt(routes, '/attempt/:id').parentNavigatorKey, isNotNull);
    });

    test('the two share the one root navigator', () {
      final routes = _topLevelRoutes();
      expect(
        _routeAt(routes, '/books/:id').parentNavigatorKey,
        same(_routeAt(routes, AppRoutes.orders).parentNavigatorKey),
      );
    });
  });

  test('book detail is declared after the shell, so downloads still wins', () {
    // '/books/downloads' lives inside the Books branch. Hoisting '/books/:id'
    // above the shell would match it first and open a book named "downloads".
    final routes = _topLevelRoutes();
    final shellIndex = routes.indexWhere((r) => r is StatefulShellRoute);
    final bookDetailIndex = _indexOfPath(routes, '/books/:id');

    expect(shellIndex, greaterThanOrEqualTo(0));
    expect(bookDetailIndex, greaterThan(shellIndex));
  });

  test('the reader stays ahead of book detail', () {
    // '/books/:id/read' is the more specific path and is matched first.
    final routes = _topLevelRoutes();
    expect(
      _indexOfPath(routes, '/books/:id/read'),
      lessThan(_indexOfPath(routes, '/books/:id')),
    );
  });
}
