import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:pointycastle/export.dart';

import 'package:psc_tips_tricks_mobile/core/offline/offline_vault.dart';
import 'package:psc_tips_tricks_mobile/data/models/offline.dart';

/// Mirrors how the vault positions a cipher, so the resume path can be checked
/// without a platform keystore or a real filesystem.
StreamCipher cipherAt(Uint8List key, Uint8List iv, int byteOffset) {
  final counter =
      OfflineVault.advanceCounter(iv, byteOffset ~/ OfflineVault.blockSize);
  final cipher = CTRStreamCipher(AESEngine())
    ..init(true, ParametersWithIV(KeyParameter(key), counter));
  final skip = byteOffset % OfflineVault.blockSize;
  if (skip > 0) cipher.process(Uint8List(skip));
  return cipher;
}

void main() {
  final key = Uint8List.fromList(List.generate(32, (i) => (i * 7 + 3) & 0xff));
  final iv = Uint8List.fromList(List.generate(16, (i) => (i * 11 + 5) & 0xff));

  group('CTR counter', () {
    test('carries across byte boundaries', () {
      final base = Uint8List(16)..[15] = 0xff;
      final advanced = OfflineVault.advanceCounter(base, 1);
      expect(advanced[15], 0x00);
      expect(advanced[14], 0x01);
    });

    test('carries across a multi-byte boundary', () {
      final base = Uint8List(16)
        ..[15] = 0xff
        ..[14] = 0xff;
      final advanced = OfflineVault.advanceCounter(base, 1);
      expect(advanced[15], 0x00);
      expect(advanced[14], 0x00);
      expect(advanced[13], 0x01);
    });

    test('leaves the counter alone when advancing by zero', () {
      expect(OfflineVault.advanceCounter(iv, 0), iv);
    });
  });

  group('resumed encryption', () {
    // The whole point of AES-CTR here: an interrupted download that carries on
    // must produce byte-for-byte what an uninterrupted one would have.
    final plaintext =
        Uint8List.fromList(List.generate(1000, (i) => (i * 31) & 0xff));

    Uint8List encryptWhole() =>
        cipherAt(key, iv, 0).process(Uint8List.fromList(plaintext));

    test('matches a single pass when split on a block boundary', () {
      const cut = 320; // 20 whole blocks
      final head = cipherAt(key, iv, 0)
          .process(Uint8List.fromList(plaintext.sublist(0, cut)));
      final tail = cipherAt(key, iv, cut)
          .process(Uint8List.fromList(plaintext.sublist(cut)));

      expect([...head, ...tail], encryptWhole());
    });

    test('matches a single pass when split mid-block', () {
      const cut = 327; // deliberately not a multiple of 16
      final head = cipherAt(key, iv, 0)
          .process(Uint8List.fromList(plaintext.sublist(0, cut)));
      final tail = cipherAt(key, iv, cut)
          .process(Uint8List.fromList(plaintext.sublist(cut)));

      expect([...head, ...tail], encryptWhole());
    });

    test('survives being interrupted many times', () {
      final assembled = <int>[];
      var offset = 0;
      for (final chunk in const [7, 100, 16, 1, 250, 400, 226]) {
        final end = offset + chunk;
        assembled.addAll(
          cipherAt(key, iv, offset)
              .process(Uint8List.fromList(plaintext.sublist(offset, end))),
        );
        offset = end;
      }

      expect(assembled, encryptWhole());
    });

    test('decrypts back to the original', () {
      final ciphertext = encryptWhole();
      // CTR is symmetric, so the same construction undoes it.
      final round = cipherAt(key, iv, 0).process(ciphertext);
      expect(round, plaintext);
    });
  });

  group('offline lease', () {
    OfflineLease leaseOf({
      Duration sinceVerified = Duration.zero,
      DateTime? validTill,
      bool revoked = false,
    }) =>
        OfflineLease(
          grantedAt: DateTime.now().subtract(const Duration(days: 30)),
          lastVerifiedAt: DateTime.now().subtract(sinceVerified),
          validTill: validTill,
          revoked: revoked,
        );

    test('a lifetime purchase never expires', () {
      expect(leaseOf().isExpired, isFalse);
    });

    test('expires once the subscription end date passes', () {
      final lapsed = leaseOf(
        validTill: DateTime.now().subtract(const Duration(minutes: 1)),
      );
      expect(lapsed.isExpired, isTrue);
    });

    test('is still valid before the end date', () {
      final live =
          leaseOf(validTill: DateTime.now().add(const Duration(days: 3)));
      expect(live.isExpired, isFalse);
    });

    test('a server revocation expires it regardless of dates', () {
      expect(leaseOf(revoked: true).isExpired, isTrue);
    });

    test('demands a check-in once the offline window lapses', () {
      expect(leaseOf(sinceVerified: const Duration(days: 3)).needsRevalidation,
          isFalse);
      expect(leaseOf(sinceVerified: const Duration(days: 8)).needsRevalidation,
          isTrue);
    });

    test('counts down the days left before a check-in is required', () {
      final lease = leaseOf(sinceVerified: const Duration(days: 2));
      expect(lease.daysUntilRevalidation, 4);
      expect(leaseOf(sinceVerified: const Duration(days: 30))
          .daysUntilRevalidation, 0);
    });
  });

  group('offline book status', () {
    OfflineBook bookWith({
      required OfflineLease lease,
      bool complete = true,
      List<OfflineAsset> assets = const [],
    }) =>
        OfflineBook(
          bookId: 'b1',
          title: 'Kerala PSC',
          author: 'Staff',
          category: 'General',
          coverAssetId: 'cover',
          readerJson: const {},
          assets: assets,
          lease: lease,
          downloadedAt: DateTime.now(),
          complete: complete,
        );

    final freshLease = OfflineLease(
      grantedAt: DateTime.now(),
      lastVerifiedAt: DateTime.now(),
    );

    test('an unfinished download reads as paused, not ready', () {
      expect(bookWith(lease: freshLease, complete: false).status,
          OfflineStatus.paused);
    });

    test('a finished download with a live lease is readable', () {
      final book = bookWith(lease: freshLease);
      expect(book.status, OfflineStatus.ready);
      expect(book.isReadable, isTrue);
    });

    test('an expired lease locks the copy', () {
      final book = bookWith(
        lease: OfflineLease(
          grantedAt: DateTime.now(),
          lastVerifiedAt: DateTime.now(),
          validTill: DateTime.now().subtract(const Duration(days: 1)),
        ),
      );
      expect(book.status, OfflineStatus.expired);
      expect(book.isReadable, isFalse);
    });

    test('a stale check-in locks the copy pending verification', () {
      final book = bookWith(
        lease: OfflineLease(
          grantedAt: DateTime.now(),
          lastVerifiedAt: DateTime.now().subtract(const Duration(days: 10)),
        ),
      );
      expect(book.status, OfflineStatus.needsRevalidation);
      expect(book.isReadable, isFalse);
    });

    test('resolves media URLs to finished assets only', () {
      final book = bookWith(
        lease: freshLease,
        assets: const [
          OfflineAsset(
            id: 'a1',
            remoteUrl: 'https://cdn/audio.mp3',
            kind: OfflineAssetKind.audio,
            complete: true,
          ),
          OfflineAsset(
            id: 'a2',
            remoteUrl: 'https://cdn/notes.pdf',
            kind: OfflineAssetKind.pdf,
          ),
        ],
      );

      expect(book.assetForUrl('https://cdn/audio.mp3')?.id, 'a1');
      // Still transferring, so it must not be served as an offline copy.
      expect(book.assetForUrl('https://cdn/notes.pdf'), isNull);
      expect(book.assetForUrl('https://cdn/missing.mp3'), isNull);
      expect(book.assetForUrl(null), isNull);
    });
  });

  group('download progress', () {
    test('is indeterminate before the asset list is known', () {
      const progress = DownloadProgress(
        bookId: 'b1',
        status: OfflineStatus.downloading,
      );
      expect(progress.fraction, isNull);
    });

    test('counts whole assets plus the one in flight', () {
      const progress = DownloadProgress(
        bookId: 'b1',
        status: OfflineStatus.downloading,
        completedAssets: 2,
        totalAssets: 4,
        currentAssetFraction: 0.5,
      );
      expect(progress.fraction, closeTo(0.625, 0.0001));
    });

    test('never reports more than complete', () {
      const progress = DownloadProgress(
        bookId: 'b1',
        status: OfflineStatus.downloading,
        completedAssets: 5,
        totalAssets: 4,
      );
      expect(progress.fraction, 1.0);
    });
  });

  group('byte formatting', () {
    test('scales to a readable unit', () {
      expect(formatBytes(0), '0 MB');
      expect(formatBytes(900), '900 B');
      expect(formatBytes(2048), '2 KB');
      expect(formatBytes(5 * 1024 * 1024), '5.0 MB');
      expect(formatBytes(1536 * 1024 * 1024), '1.5 GB');
    });
  });
}
