import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/book.dart';
import '../../data/models/offline.dart';
import '../../data/repositories/offline_repository.dart';

/// Drives offline downloads and keeps the library's lease state honest.
///
/// State is a map of book id to [DownloadProgress] covering both live transfers
/// and finished books, so any widget can ask about one book without holding the
/// whole library.
class DownloadManager extends StateNotifier<Map<String, DownloadProgress>> {
  DownloadManager(this._repo) : super(const {}) {
    unawaited(_restore());
  }

  final OfflineRepository _repo;

  final Map<String, CancelToken> _cancelTokens = {};
  final Map<String, OfflineBook> _library = {};

  /// Wall-clock of the last progress emission, so a fast connection delivering
  /// chunks every few milliseconds does not rebuild the UI on every one.
  DateTime _lastEmit = DateTime.fromMillisecondsSinceEpoch(0);

  /// Books deleted while their transfer was still running. The loop checks this
  /// before writing anything back, so a delete cannot be undone by the
  /// in-flight download finishing its teardown.
  final Set<String> _discarded = {};

  /// The offline library as last read from disk, newest first.
  List<OfflineBook> get library {
    final books = _library.values.toList()
      ..sort((a, b) => b.downloadedAt.compareTo(a.downloadedAt));
    return books;
  }

  OfflineBook? bookFor(String bookId) => _library[bookId];

  DownloadProgress progressFor(String bookId) =>
      state[bookId] ??
      DownloadProgress(bookId: bookId, status: OfflineStatus.none);

  /// Rebuilds in-memory state from the vault on start.
  ///
  /// A transfer that was in flight when the process died comes back as paused
  /// rather than downloading — the bytes are on disk, but nothing is moving.
  Future<void> _restore() async {
    await _repo.purgeWorkingCopies();
    try {
      final books = await _repo.library();
      for (final book in books) {
        _library[book.bookId] = book;
      }
      state = {
        for (final book in books)
          book.bookId: DownloadProgress(
            bookId: book.bookId,
            status: book.complete ? book.status : OfflineStatus.paused,
            completedAssets: book.assets.where((a) => a.complete).length,
            totalAssets: book.assets.length,
            receivedBytes: book.totalBytes,
          ),
      };
    } catch (e) {
      if (kDebugMode) debugPrint('Could not restore offline library: $e');
    }
  }

  void _emit(String bookId, DownloadProgress progress) {
    _lastEmit = DateTime.now();
    state = {...state, bookId: progress};
  }

  /// Emits at most ~12 times a second. Byte-level callbacks arrive far faster
  /// than a progress bar can usefully show, and each one rebuilds every widget
  /// watching the download.
  void _emitThrottled(String bookId, DownloadProgress progress) {
    if (DateTime.now().difference(_lastEmit).inMilliseconds < 80) return;
    _emit(bookId, progress);
  }

  // ── Download ──────────────────────────────────────────────────────────

  /// Takes an offline copy of [book].
  ///
  /// The server is asked for permission first and its refusal is final, so a
  /// book that is unpaid, expired or revoked never reaches the transfer loop.
  Future<void> download(Book book) async {
    final bookId = book.id;
    if (_cancelTokens.containsKey(bookId)) return;

    _discarded.remove(bookId);
    final cancelToken = CancelToken();
    _cancelTokens[bookId] = cancelToken;
    _emit(
      bookId,
      DownloadProgress(bookId: bookId, status: OfflineStatus.downloading),
    );

    try {
      // 1. The authoritative gate. Throws 403 for anything unpurchased or
      //    lapsed, and is also what records the download against the book.
      await _repo.assertDownloadable(bookId);

      // 2. The chapter tree, which is itself access-gated server-side.
      final readerJson = await _repo.fetchReaderPayload(bookId);

      // 3. Resume where a previous attempt left off, if there was one.
      final existing = await _repo.read(bookId);
      final assets = _mergeAssets(
        _collectAssets(bookId, book, readerJson),
        existing?.assets ?? const [],
      );
      final coverAssetId = assets
          .firstWhere(
            (a) => a.kind == OfflineAssetKind.cover,
            orElse: () => assets.isEmpty
                ? const OfflineAsset(
                    id: '', remoteUrl: '', kind: OfflineAssetKind.cover)
                : assets.first,
          )
          .id;

      var manifest = OfflineBook(
        bookId: bookId,
        title: book.title,
        author: book.author,
        category: book.category,
        coverAssetId: coverAssetId,
        readerJson: readerJson,
        assets: assets,
        lease: existing?.lease ??
            OfflineLease(
              grantedAt: DateTime.now(),
              lastVerifiedAt: DateTime.now(),
              validTill: book.access?.validTill,
            ),
        downloadedAt: existing?.downloadedAt ?? DateTime.now(),
      );
      // Written before any bytes move, so a process death mid-transfer still
      // leaves something to resume from.
      await _repo.save(manifest);

      var completed = assets.where((a) => a.complete).length;
      var totalBytes = assets.fold<int>(0, (sum, a) => sum + a.bytes);

      _emit(
        bookId,
        DownloadProgress(
          bookId: bookId,
          status: OfflineStatus.downloading,
          completedAssets: completed,
          totalAssets: assets.length,
          receivedBytes: totalBytes,
        ),
      );

      for (var i = 0; i < assets.length; i++) {
        if (cancelToken.isCancelled) break;
        final asset = manifest.assets[i];
        if (asset.complete) continue;

        final bytes = await _repo.downloadAsset(
          bookId: bookId,
          asset: asset,
          cancelToken: cancelToken,
          onProgress: (received, total) {
            _emitThrottled(
              bookId,
              progressFor(bookId).copyWith(
                status: OfflineStatus.downloading,
                completedAssets: completed,
                totalAssets: assets.length,
                receivedBytes: totalBytes + received,
                currentAssetFraction: total > 0 ? received / total : 0,
              ),
            );
          },
        );

        completed += 1;
        totalBytes += bytes;

        final updated = [...manifest.assets];
        updated[i] = asset.copyWith(bytes: bytes, complete: true);
        manifest = manifest.copyWith(assets: updated, totalBytes: totalBytes);
        // Checkpoint after every file: an interrupted download never has to
        // re-fetch anything it already finished.
        await _repo.save(manifest);

        _emit(
          bookId,
          progressFor(bookId).copyWith(
            completedAssets: completed,
            currentAssetFraction: 0,
            receivedBytes: totalBytes,
          ),
        );
      }

      if (cancelToken.isCancelled) {
        if (_discarded.contains(bookId)) return;
        _library[bookId] = manifest;
        _emit(
          bookId,
          progressFor(bookId).copyWith(status: OfflineStatus.paused),
        );
        return;
      }

      manifest = manifest.copyWith(complete: true, totalBytes: totalBytes);
      await _repo.save(manifest);
      _library[bookId] = manifest;

      _emit(
        bookId,
        DownloadProgress(
          bookId: bookId,
          status: manifest.status,
          completedAssets: completed,
          totalAssets: assets.length,
          receivedBytes: totalBytes,
        ),
      );
    } on ApiException catch (e) {
      if (_discarded.contains(bookId)) return;
      _emit(
        bookId,
        progressFor(bookId).copyWith(
          status: e.isForbidden ? OfflineStatus.expired : OfflineStatus.failed,
          error: e.message,
        ),
      );
    } on DioException catch (e) {
      if (_discarded.contains(bookId)) return;
      _emit(
        bookId,
        progressFor(bookId).copyWith(
          status: CancelToken.isCancel(e)
              ? OfflineStatus.paused
              : OfflineStatus.failed,
          error: CancelToken.isCancel(e) ? null : 'Download interrupted.',
          clearError: CancelToken.isCancel(e),
        ),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('Offline download failed: $e');
      if (_discarded.contains(bookId)) return;
      _emit(
        bookId,
        progressFor(bookId).copyWith(
          status: OfflineStatus.failed,
          error: 'Could not finish the download. Please try again.',
        ),
      );
    } finally {
      _cancelTokens.remove(bookId);
    }
  }

  /// Reconciles a freshly computed asset list with what a previous attempt
  /// already finished, so a resumed download re-fetches nothing it has and
  /// still picks up anything the book has gained since.
  List<OfflineAsset> _mergeAssets(
    List<OfflineAsset> fresh,
    List<OfflineAsset> previous,
  ) {
    final done = {
      for (final asset in previous)
        if (asset.complete) asset.remoteUrl: asset,
    };
    return [
      for (final asset in fresh)
        done[asset.remoteUrl] ?? asset,
    ];
  }

  /// Every file the offline reader will need. YouTube links are deliberately
  /// absent — those stream from YouTube and cannot be stored, so a topic whose
  /// only media is a video still needs a connection to watch it.
  List<OfflineAsset> _collectAssets(
    String bookId,
    Book book,
    Map<String, dynamic> readerJson,
  ) {
    final seen = <String>{};
    final assets = <OfflineAsset>[];

    void add(String? url, OfflineAssetKind kind) {
      if (url == null || url.trim().isEmpty) return;
      if (!seen.add(url)) return;
      assets.add(
        OfflineAsset(
          id: _repo.vault.assetId(bookId, url),
          remoteUrl: url,
          kind: kind,
        ),
      );
    }

    add(book.coverUrl, OfflineAssetKind.cover);

    final content = BookReaderContent.fromJson(readerJson);
    for (final chapter in content.chapters) {
      add(chapter.audioUrl, OfflineAssetKind.audio);
      add(chapter.pdfUrl, OfflineAssetKind.pdf);
      for (final topic in chapter.topics) {
        add(topic.audioUrl, OfflineAssetKind.audio);
        add(topic.pdfUrl, OfflineAssetKind.pdf);
        for (final subtopic in topic.subtopics) {
          add(subtopic.audioUrl, OfflineAssetKind.audio);
          add(subtopic.pdfUrl, OfflineAssetKind.pdf);
        }
      }
    }

    return assets;
  }

  /// Stops a transfer, leaving the partial bytes in place to resume from.
  void pause(String bookId) {
    _cancelTokens[bookId]?.cancel('paused');
    _cancelTokens.remove(bookId);
    _emit(bookId, progressFor(bookId).copyWith(status: OfflineStatus.paused));
  }

  Future<void> remove(String bookId) async {
    _discarded.add(bookId);
    _cancelTokens[bookId]?.cancel('deleted');
    _cancelTokens.remove(bookId);
    await _repo.delete(bookId);
    _library.remove(bookId);
    final next = {...state}..remove(bookId);
    state = next;
  }

  // ── Leases ────────────────────────────────────────────────────────────

  /// Re-checks one book against the server and rewrites its lease.
  ///
  /// Returns the status the book now has. A network failure leaves the lease
  /// exactly as it was — being offline is not evidence that a purchase lapsed.
  Future<OfflineStatus> revalidate(String bookId) async {
    final book = _library[bookId];
    if (book == null) return OfflineStatus.none;

    try {
      final lease = await _repo.revalidate(bookId, book.lease);
      final updated = book.copyWith(lease: lease);
      await _repo.save(updated);
      _library[bookId] = updated;
      _emit(bookId, progressFor(bookId).copyWith(status: updated.status));
      return updated.status;
    } on ApiException catch (e) {
      if (kDebugMode) debugPrint('Revalidation failed for $bookId: ${e.message}');
      return book.status;
    }
  }

  /// Opportunistic sweep: refreshes every lease that is close to needing it.
  ///
  /// Called when the app comes back to the foreground, so a student who is
  /// online in the normal course of using the app rarely meets the lock screen.
  Future<void> revalidateStale() async {
    for (final book in _library.values.toList()) {
      final lease = book.lease;
      final halfway = lease.lastVerifiedAt.add(
        Duration(
          milliseconds: OfflineLease.revalidateAfter.inMilliseconds ~/ 2,
        ),
      );
      if (DateTime.now().isAfter(halfway)) {
        await revalidate(book.bookId);
      }
    }
  }

  /// Re-reads the library from disk — used after a delete or an external change.
  Future<void> refresh() => _restore();

  @override
  void dispose() {
    for (final token in _cancelTokens.values) {
      token.cancel('disposed');
    }
    _cancelTokens.clear();
    super.dispose();
  }
}
