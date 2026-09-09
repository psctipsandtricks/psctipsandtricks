import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/core/widgets/app_image.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/book_card.dart';
import 'package:psc_tips_tricks_mobile/features/home/home_providers.dart';
import 'package:psc_tips_tricks_mobile/features/home/widgets/home_book_carousel.dart';

void main() {
  group('Book Cover URL resolution', () {
    test('Catalog Cover (16:9) is prioritized for effectiveCatalogCoverUrl', () {
      const book = Book(
        id: 'book-1',
        title: 'Test Book',
        author: 'Anto',
        description: 'Test Description',
        coverUrl: 'https://cdn.example.com/catalog-cover-16-9.jpg',
        heroCoverUrl: 'https://cdn.example.com/hero-cover-3-4.jpg',
        price: 1000,
        discountPercent: 20,
        finalPrice: 800,
        category: 'General',
        isPremium: true,
        downloadCount: 10,
      );

      expect(book.effectiveCatalogCoverUrl, 'https://cdn.example.com/catalog-cover-16-9.jpg');
      expect(book.effectiveHeroCoverUrl, 'https://cdn.example.com/hero-cover-3-4.jpg');
    });

    test('Falls back gracefully if one of the covers is empty', () {
      const bookWithoutCatalog = Book(
        id: 'book-2',
        title: 'Hero Only',
        author: 'Author',
        description: '',
        coverUrl: '',
        heroCoverUrl: 'https://cdn.example.com/hero-cover-3-4.jpg',
        price: 0,
        discountPercent: 0,
        finalPrice: 0,
        category: 'PSC',
        isPremium: false,
        downloadCount: 0,
      );

      expect(bookWithoutCatalog.effectiveCatalogCoverUrl, 'https://cdn.example.com/hero-cover-3-4.jpg');

      const bookWithoutHero = Book(
        id: 'book-3',
        title: 'Catalog Only',
        author: 'Author',
        description: '',
        coverUrl: 'https://cdn.example.com/catalog-cover-16-9.jpg',
        heroCoverUrl: null,
        price: 0,
        discountPercent: 0,
        finalPrice: 0,
        category: 'PSC',
        isPremium: false,
        downloadCount: 0,
      );

      expect(bookWithoutHero.effectiveHeroCoverUrl, 'https://cdn.example.com/catalog-cover-16-9.jpg');
    });
  });

  group('Book widgets use Catalog Cover (16:9)', () {
    testWidgets('BookTile in E-Book catalog section renders 16:9 catalog cover', (tester) async {
      const book = Book(
        id: 'book-1',
        title: 'Test Book',
        author: 'Anto',
        description: 'Test Description',
        coverUrl: 'https://cdn.example.com/catalog-cover-16-9.jpg',
        heroCoverUrl: 'https://cdn.example.com/hero-cover-3-4.jpg',
        price: 1000,
        discountPercent: 20,
        finalPrice: 800,
        category: 'General',
        isPremium: true,
        downloadCount: 10,
      );

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: BookTile(book: book, width: 240),
        ),
      ));

      final appImageFinder = find.byType(AppImage);
      expect(appImageFinder, findsOneWidget);

      final appImage = tester.widget<AppImage>(appImageFinder);
      expect(appImage.url, 'https://cdn.example.com/catalog-cover-16-9.jpg');
      expect(appImage.width, 240);
      expect(appImage.height, 240 * (9 / 16));
    });

    testWidgets('BookCard renders effectiveHeroCoverUrl (3:4 book size)', (tester) async {
      const book = Book(
        id: 'book-1',
        title: 'Test Book',
        author: 'Anto',
        description: 'Test Description',
        coverUrl: 'https://cdn.example.com/catalog-cover-16-9.jpg',
        heroCoverUrl: 'https://cdn.example.com/hero-cover-3-4.jpg',
        price: 1000,
        discountPercent: 20,
        finalPrice: 800,
        category: 'General',
        isPremium: true,
        downloadCount: 10,
      );

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: BookCard(book: book),
        ),
      ));

      final bookCoverFinder = find.byType(BookCover);
      expect(bookCoverFinder, findsOneWidget);

      final bookCover = tester.widget<BookCover>(bookCoverFinder);
      expect(bookCover.url, 'https://cdn.example.com/hero-cover-3-4.jpg');
    });

    testWidgets('HomeBookCarousel.artHeightFor uses 3:4 on phone and 16:9 on tablet', (tester) async {
      // Phone view (width: 400, height: 800)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(size: Size(400, 800)),
            child: Builder(
              builder: (context) {
                final height = HomeBookCarousel.artHeightFor(context);
                expect(height, closeTo(400 * (4 / 3) * 0.90, 0.01));
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );

      // Tablet view (width: 800, height: 1200)
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(size: Size(800, 1200)),
            child: Builder(
              builder: (context) {
                final height = HomeBookCarousel.artHeightFor(context);
                expect(height, closeTo(800 * (9 / 16), 0.01));
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
    });

    testWidgets('HomeBookCarousel uses 3:4 hero cover on phone and 16:9 catalog cover on tablet', (tester) async {
      const testBook = Book(
        id: 'book-1',
        title: 'Test Book',
        author: 'Anto',
        description: 'Test Description',
        coverUrl: 'https://cdn.example.com/catalog-cover-16-9.jpg',
        heroCoverUrl: 'https://cdn.example.com/hero-cover-3-4.jpg',
        price: 1000,
        discountPercent: 20,
        finalPrice: 800,
        category: 'General',
        isPremium: true,
        downloadCount: 10,
      );

      // 1. Phone View
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            featuredBooksProvider.overrideWith((ref) => Future.value([testBook])),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const MediaQuery(
              data: MediaQueryData(size: Size(400, 800)),
              child: Scaffold(
                body: HomeBookCarousel(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final phoneAppImages = tester.widgetList<AppImage>(find.byType(AppImage));
      expect(phoneAppImages.any((img) => img.url == 'https://cdn.example.com/hero-cover-3-4.jpg'), isTrue);

      // 2. Tablet View
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            featuredBooksProvider.overrideWith((ref) => Future.value([testBook])),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const MediaQuery(
              data: MediaQueryData(size: Size(800, 1200)),
              child: Scaffold(
                body: HomeBookCarousel(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final tabletAppImages = tester.widgetList<AppImage>(find.byType(AppImage));
      expect(tabletAppImages.any((img) => img.url == 'https://cdn.example.com/catalog-cover-16-9.jpg'), isTrue);
    });
  });
}
