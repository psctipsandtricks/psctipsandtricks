import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/models/user.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/books_repository.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';

/// Stands in for the API, answering the way the real one does: the access
/// verdict depends on who is asking.
class _FakeBooksRepository extends BooksRepository {
  _FakeBooksRepository(this._viewer) : super(ApiClient(tokenStore: TokenStore()));

  /// Read at call time, so the fake reflects whoever is signed in *now*.
  final String? Function() _viewer;

  int calls = 0;

  Book _book({required bool owned}) => Book(
        id: 'b1',
        title: 'Kerala History',
        author: 'PSC',
        description: '',
        coverUrl: '',
        price: 999,
        discountPercent: 50,
        finalPrice: 499,
        category: 'Kerala PSC',
        isPremium: true,
        downloadCount: 3,
        previewPdfUrl: 'https://cdn.test/preview.pdf',
        previewAudioUrl: 'https://cdn.test/sample.m4a',
        access: AccessState(
          isPaid: true,
          hasAccess: owned,
          price: 499,
          reason: owned ? AccessReason.purchased : AccessReason.loginRequired,
        ),
      );

  @override
  Future<Book> fetchBook(String id) async {
    calls += 1;
    // The purchaser owns it; a guest does not.
    return _book(owned: _viewer() == 'buyer');
  }

  @override
  Future<List<Book>> fetchBooks({
    String? search,
    String? category,
    int page = 1,
    int limit = 24,
  }) async {
    calls += 1;
    return [_book(owned: _viewer() == 'buyer')];
  }
}

const _buyer = User(
  id: 'buyer',
  email: 'buyer@test.local',
  name: 'Buyer',
  role: UserRole.student,
  isPremium: false,
  isSuspended: false,
);

void main() {
  late StateController<User?> viewer;

  ProviderContainer boot() {
    final signedIn = StateProvider<User?>((ref) => null);
    late final _FakeBooksRepository repo;

    final container = ProviderContainer(overrides: [
      currentUserProvider.overrideWith((ref) => ref.watch(signedIn)),
      booksRepositoryProvider.overrideWith((ref) => repo),
    ]);
    repo = _FakeBooksRepository(() => container.read(signedIn)?.id);
    addTearDown(container.dispose);
    viewer = container.read(signedIn.notifier);
    return container;
  }

  test('a book fetched as a guest is re-asked once someone signs in', () async {
    final container = boot();

    // Browsing signed out: the API can only say "log in".
    final asGuest = await container.read(bookDetailProvider('b1').future);
    expect(asGuest.isUnlocked, isFalse);
    expect(asGuest.access!.needsLogin, isTrue);

    // The session resolves — this is the moment the old code got wrong. The
    // verdict was kept alive for the session, so a book the student owned went
    // on advertising "Unlock full access".
    viewer.state = _buyer;

    final asBuyer = await container.read(bookDetailProvider('b1').future);
    expect(asBuyer.isUnlocked, isTrue,
        reason: 'the purchased book must unlock once the viewer is known');
    expect(asBuyer.access!.reason, AccessReason.purchased);
  });

  test('the catalog rows are re-asked too', () async {
    final container = boot();

    final asGuest = await container.read(booksProvider.future);
    expect(asGuest.single.isUnlocked, isFalse);

    viewer.state = _buyer;

    final asBuyer = await container.read(booksProvider.future);
    expect(asBuyer.single.isUnlocked, isTrue);
  });

  test('signing out locks the book again', () async {
    final container = boot();
    viewer.state = _buyer;
    expect((await container.read(bookDetailProvider('b1').future)).isUnlocked,
        isTrue);

    viewer.state = null;
    expect((await container.read(bookDetailProvider('b1').future)).isUnlocked,
        isFalse);
  });

  test('an unrelated profile change does not refetch the catalog', () async {
    final container = boot();
    viewer.state = _buyer;
    await container.read(bookDetailProvider('b1').future);

    final before = container.read(booksRepositoryProvider) as _FakeBooksRepository;
    final callsBefore = before.calls;

    // Same person, new avatar: the access verdict cannot have changed, and
    // refetching the whole catalog on a profile edit would be wasteful.
    viewer.state = const User(
      id: 'buyer',
      email: 'buyer@test.local',
      name: 'Buyer',
      role: UserRole.student,
      isPremium: false,
      isSuspended: false,
      avatarUrl: 'https://cdn.test/new-avatar.png',
    );
    await container.read(bookDetailProvider('b1').future);

    expect(before.calls, callsBefore);
  });
}
