import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/offline/offline_vault.dart';
import '../models/book.dart';
import '../models/offline.dart';

/// Reads and writes the offline library, and moves the bytes.
///
/// Access is never decided here: the server's own `POST /books/:id/download`
/// gate is called first and its refusal is what stops a download, so the app
/// cannot widen entitlement by getting its local check wrong.
class OfflineRepository {
  OfflineRepository(this._api, this._vault);

  final ApiClient _api;
  final OfflineVault _vault;

  /// Media lives on public storage URLs that need no credentials, so it is
  /// fetched with a bare client. Reusing the authenticated one would attach the
  /// student's bearer token to a third-party host for no reason.
  late final Dio _media = Dio(
    BaseOptions(
      connectTimeout: AppConfig.connectTimeout,
      // Large audio files legitimately take a while between chunks on a weak
      // connection; the API's short receive timeout would abort them.
      receiveTimeout: const Duration(minutes: 5),
      followRedirects: true,
    ),
  );

  OfflineVault get vault => _vault;

  // ── Library ───────────────────────────────────────────────────────────

  Future<List<OfflineBook>> library() async {
    final manifests = await _vault.listManifests();
    final books = manifests.map(OfflineBook.fromJson).toList()
      ..sort((a, b) => b.downloadedAt.compareTo(a.downloadedAt));
    return books;
  }

  Future<OfflineBook?> read(String bookId) async {
    final manifest = await _vault.readManifest(bookId);
    return manifest == null ? null : OfflineBook.fromJson(manifest);
  }

  Future<void> save(OfflineBook book) =>
      _vault.writeManifest(book.bookId, book.toJson());

  Future<void> delete(String bookId) async {
    await _vault.deleteBook(bookId);
    await _vault.purgePlaintextCache();
  }

  /// Erases every downloaded book and the vault key. Called on sign-out so an
  /// account's offline copies never open under the next account on the device.
  Future<void> wipeLibrary() => _vault.wipe();

  Future<int> sizeOnDisk(String bookId) => _vault.bookSize(bookId);

  // ── Entitlement ───────────────────────────────────────────────────────

  /// Asks the server whether this student may take a copy, and records the
  /// download against the book. Throws [ApiException] when refused.
  Future<void> assertDownloadable(String bookId) =>
      _api.post<dynamic>('/books/$bookId/download');

  /// Re-checks a downloaded book against the server and returns the refreshed
  /// lease, plus the book as the server sees it now. Requires a connection; a
  /// network failure is surfaced so the caller can leave the existing lease
  /// untouched rather than assuming the worst.
  ///
  /// The fresh [Book] is handed back alongside the lease so a caller can also
  /// notice things like a cover swapped in the Admin Panel since the download,
  /// without a second round trip for the same book.
  Future<(OfflineLease, Book)> revalidate(
    String bookId,
    OfflineLease current,
  ) async {
    final res = await _api.get<Map<String, dynamic>>('/books/$bookId');
    final book = Book.fromJson(res);
    final access = book.access;

    // No access block at all means the book is free — nothing to expire.
    if (access == null) {
      return (
        current.copyWith(
          lastVerifiedAt: DateTime.now(),
          revoked: false,
          clearValidTill: true,
        ),
        book,
      );
    }

    if (!access.hasAccess) {
      return (
        current.copyWith(lastVerifiedAt: DateTime.now(), revoked: true),
        book,
      );
    }

    return (
      OfflineLease(
        grantedAt: current.grantedAt,
        lastVerifiedAt: DateTime.now(),
        validTill: access.validTill,
        revoked: false,
      ),
      book,
    );
  }

  // ── Transfer ──────────────────────────────────────────────────────────

  /// Streams one asset into the vault, encrypting as the bytes land.
  ///
  /// Resumes from whatever is already in the `.part` file by asking for the
  /// remaining byte range. A server that ignores `Range` answers 200 with the
  /// whole file, which is detected and restarted cleanly rather than producing
  /// a file with a duplicated prefix.
  ///
  /// Returns the finished size in bytes.
  Future<int> downloadAsset({
    required String bookId,
    required OfflineAsset asset,
    required CancelToken cancelToken,
    void Function(int received, int total)? onProgress,
  }) async {
    final partial = await _vault.partialFile(bookId, asset.id);
    var offset = partial.existsSync() ? partial.lengthSync() : 0;

    // Absolute URLs point at public storage; a relative one is served by our
    // own API and needs the session token.
    final isAbsolute = asset.remoteUrl.startsWith('http');
    final url = isAbsolute
        ? asset.remoteUrl
        : '${AppConfig.apiBaseUrl}${asset.remoteUrl.startsWith('/') ? '' : '/'}${asset.remoteUrl}';

    Response<ResponseBody> response;
    try {
      response = await _media.get<ResponseBody>(
        url,
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          headers: {
            if (offset > 0) 'Range': 'bytes=$offset-',
            if (!isAbsolute) ...await _api.authHeader(),
          },
          // 416 means the range is past the end — the file is already whole.
          validateStatus: (status) =>
              status != null && (status < 400 || status == 416),
          followRedirects: true,
        ),
      );
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) rethrow;
      throw ApiException.fromDio(e);
    }

    final status = response.statusCode ?? 0;

    if (status == 416) {
      await _promote(bookId, asset.id, partial);
      return offset;
    }

    // The server sent the whole file despite the range request: start over so
    // the two halves cannot be spliced together.
    if (offset > 0 && status != 206) {
      if (partial.existsSync()) await partial.delete();
      offset = 0;
    }

    final remaining = int.tryParse(
          response.headers.value(Headers.contentLengthHeader) ?? '',
        ) ??
        0;
    final total = remaining > 0 ? offset + remaining : 0;

    final sink = partial.openWrite(
      mode: offset > 0 ? FileMode.append : FileMode.write,
    );
    // One cipher for the whole transfer, positioned at the resume point: CTR
    // carries its own counter forward across chunks.
    final cipher = await _vault.cipherAt(asset.id, offset);
    var received = offset;

    try {
      await for (final chunk in response.data!.stream) {
        sink.add(cipher.process(Uint8List.fromList(chunk)));
        received += chunk.length;
        onProgress?.call(received, total);
      }
      await sink.flush();
    } catch (e) {
      // Whatever landed stays on disk — that is the resume point.
      await sink.flush().catchError((_) {});
      await sink.close().catchError((_) {});
      if (e is DioException) {
        if (CancelToken.isCancel(e)) rethrow;
        throw ApiException.fromDio(e);
      }
      rethrow;
    }
    await sink.close();

    await _promote(bookId, asset.id, partial);
    return received;
  }

  /// Moves a finished `.part` into place as the real asset.
  Future<void> _promote(String bookId, String assetId, File partial) async {
    final target = await _vault.assetFile(bookId, assetId);
    if (partial.existsSync()) {
      if (target.existsSync()) await target.delete();
      await partial.rename(target.path);
    }
  }

  /// Fetches the chapter tree that the offline reader will replay.
  Future<Map<String, dynamic>> fetchReaderPayload(String bookId) =>
      _api.get<Map<String, dynamic>>('/books/$bookId/reader');

  /// Decrypts an asset to a private cache file a native viewer can open.
  Future<File?> openAsset(String bookId, OfflineAsset asset) =>
      _vault.materialise(bookId, asset.id, extension: asset.kind.extension);

  Future<void> closeAsset(OfflineAsset asset) =>
      _vault.releasePlaintext(asset.id);

  /// Drops every decrypted working copy — called at app start so plaintext
  /// never outlives the session that needed it.
  Future<void> purgeWorkingCopies() async {
    try {
      await _vault.purgePlaintextCache();
    } catch (e) {
      if (kDebugMode) debugPrint('Could not purge offline cache: $e');
    }
  }
}
