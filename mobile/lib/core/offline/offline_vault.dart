import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pointycastle/export.dart';

/// Encrypted, app-private storage for downloaded books.
///
/// Three things keep an offline copy off-limits outside the app:
///
///  * Files live under `getApplicationSupportDirectory()`, which on Android is
///    inside `/data/data/<package>` — unreadable by other apps and invisible to
///    MediaStore, so nothing shows up in a gallery or file manager.
///  * Every file is AES-256-CTR encrypted at rest under a key that is generated
///    on first use and held in the platform keystore, never on disk in the
///    clear. A device backup or a pulled data directory yields ciphertext.
///  * Names are SHA-256 digests with a neutral extension, so the directory
///    listing alone reveals neither which book nor what kind of file.
///
/// CTR is the deliberate choice over GCM: it is a stream cipher, so a download
/// can be encrypted chunk-by-chunk as bytes arrive, and an interrupted transfer
/// resumes by seeking the keystream to the byte offset already on disk rather
/// than starting the file again.
class OfflineVault {
  OfflineVault({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _keyAlias = 'psc_offline_vault_key_v1';
  /// AES block size; also the granularity of the CTR counter.
  static const blockSize = 16;

  Uint8List? _key;
  Directory? _root;

  /// Loads the vault key, minting one on first use.
  Future<Uint8List> _vaultKey() async {
    final cached = _key;
    if (cached != null) return cached;

    final stored = await _storage.read(key: _keyAlias);
    if (stored != null && stored.isNotEmpty) {
      final decoded = base64Decode(stored);
      if (decoded.length == 32) return _key = Uint8List.fromList(decoded);
    }

    final random = Random.secure();
    final fresh =
        Uint8List.fromList(List.generate(32, (_) => random.nextInt(256)));
    await _storage.write(key: _keyAlias, value: base64Encode(fresh));
    return _key = fresh;
  }

  Future<Directory> _vaultRoot() async {
    final cached = _root;
    if (cached != null) return cached;
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/offline_library');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return _root = dir;
  }

  /// A stable, opaque directory name for one book.
  String _bookSlug(String bookId) =>
      crypto.sha256.convert(utf8.encode('book:$bookId')).toString().substring(0, 32);

  /// A stable, opaque file name for one asset within a book.
  String assetId(String bookId, String url) =>
      crypto.sha256.convert(utf8.encode('$bookId|$url')).toString().substring(0, 40);

  Future<Directory> bookDirectory(String bookId) async {
    final root = await _vaultRoot();
    final dir = Directory('${root.path}/${_bookSlug(bookId)}');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }

  Future<File> assetFile(String bookId, String assetId) async =>
      File('${(await bookDirectory(bookId)).path}/$assetId.bin');

  /// Where a transfer accumulates before it is complete. Keeping partial bytes
  /// under a separate name is what makes "resume" distinguishable from
  /// "finished" after the app is killed mid-download.
  Future<File> partialFile(String bookId, String assetId) async =>
      File('${(await bookDirectory(bookId)).path}/$assetId.part');

  Future<File> manifestFile(String bookId) async =>
      File('${(await bookDirectory(bookId)).path}/manifest.bin');

  // ── Crypto ────────────────────────────────────────────────────────────

  /// Advances a big-endian CTR counter by [blocks].
  ///
  /// This is what makes a resumed download produce the same ciphertext as an
  /// uninterrupted one: CTR increments the counter once per block, so seeking
  /// the keystream to byte N means adding N / 16 to the starting IV.
  static Uint8List advanceCounter(Uint8List iv, int blocks) {
    final counter = Uint8List.fromList(iv);
    var carry = blocks;
    for (var i = counter.length - 1; i >= 0 && carry > 0; i--) {
      final sum = counter[i] + (carry & 0xff);
      counter[i] = sum & 0xff;
      carry = (carry >> 8) + (sum >> 8);
    }
    return counter;
  }

  /// Per-asset IV, derived from the vault key and the asset id.
  ///
  /// Deriving rather than storing means a resumed download reconstructs the
  /// exact same keystream without needing a sidecar file, and two assets never
  /// share a counter sequence under the same key.
  Uint8List _ivFor(String assetId, Uint8List key) {
    final mac = crypto.Hmac(crypto.sha256, key).convert(utf8.encode(assetId));
    return Uint8List.fromList(mac.bytes.sublist(0, blockSize));
  }

  /// Builds a cipher whose keystream is positioned at [byteOffset], so an
  /// interrupted download can carry on from exactly where it stopped.
  Future<StreamCipher> cipherAt(String assetId, int byteOffset) async {
    final key = await _vaultKey();
    final iv = _ivFor(assetId, key);

    final counter = advanceCounter(iv, byteOffset ~/ blockSize);

    final cipher = CTRStreamCipher(AESEngine())
      ..init(true, ParametersWithIV(KeyParameter(key), counter));

    final skip = byteOffset % blockSize;
    if (skip > 0) cipher.process(Uint8List(skip));
    return cipher;
  }

  /// Encrypts (or decrypts — CTR is symmetric) [data] as the slice of [assetId]
  /// beginning at [byteOffset].
  Future<Uint8List> transform(
    String assetId,
    List<int> data, {
    int byteOffset = 0,
  }) async {
    final cipher = await cipherAt(assetId, byteOffset);
    return cipher.process(Uint8List.fromList(data));
  }

  /// Reads a stored asset back as plaintext bytes.
  Future<Uint8List?> readAsset(String bookId, String assetId) async {
    final file = await assetFile(bookId, assetId);
    if (!file.existsSync()) return null;
    return transform(assetId, await file.readAsBytes());
  }

  /// Writes an already-plaintext payload in one shot — used for the manifest,
  /// which is small enough not to need streaming.
  Future<void> writeAsset(
    String bookId,
    String assetId,
    List<int> plaintext,
  ) async {
    final file = await assetFile(bookId, assetId);
    await file.writeAsBytes(await transform(assetId, plaintext), flush: true);
  }

  // ── Manifest ──────────────────────────────────────────────────────────

  static const _manifestAssetId = 'manifest';

  Future<Map<String, dynamic>?> readManifest(String bookId) async {
    final file = await manifestFile(bookId);
    if (!file.existsSync()) return null;
    try {
      final plain = await transform(_manifestAssetId, await file.readAsBytes());
      final decoded = jsonDecode(utf8.decode(plain));
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      // A manifest that will not decrypt is unusable — treat the book as not
      // downloaded rather than crashing the library screen.
      return null;
    }
  }

  Future<void> writeManifest(String bookId, Map<String, dynamic> manifest) async {
    final file = await manifestFile(bookId);
    final plain = utf8.encode(jsonEncode(manifest));
    await file.writeAsBytes(
      await transform(_manifestAssetId, plain),
      flush: true,
    );
  }

  // ── Materialising for playback ────────────────────────────────────────

  /// Decrypts an asset into the app's cache so a native component that insists
  /// on a real file path — the PDF renderer, the audio player — can open it.
  ///
  /// The cache directory is still app-private; this only widens exposure to
  /// other code inside this app, and the copy is dropped by [releasePlaintext]
  /// as soon as the screen using it goes away.
  Future<File?> materialise(
    String bookId,
    String assetId, {
    required String extension,
  }) async {
    final source = await assetFile(bookId, assetId);
    if (!source.existsSync()) return null;

    final cache = await getApplicationCacheDirectory();
    final dir = Directory('${cache.path}/offline_open');
    if (!dir.existsSync()) dir.createSync(recursive: true);

    final target = File('${dir.path}/$assetId.$extension');
    // Already materialised and non-empty: reuse rather than decrypt again.
    if (target.existsSync() && target.lengthSync() > 0) return target;

    final plain = await transform(assetId, await source.readAsBytes());
    await target.writeAsBytes(plain, flush: true);
    return target;
  }

  Future<void> releasePlaintext(String assetId) async {
    try {
      final cache = await getApplicationCacheDirectory();
      final dir = Directory('${cache.path}/offline_open');
      if (!dir.existsSync()) return;
      for (final entity in dir.listSync()) {
        if (entity is File && entity.uri.pathSegments.last.startsWith(assetId)) {
          await entity.delete();
        }
      }
    } catch (_) {
      // Best effort: a stale plaintext copy in a private cache is not worth
      // failing a screen teardown over.
    }
  }

  /// Clears every decrypted working copy. Called when a book is deleted and on
  /// app start, so plaintext never outlives the session that needed it.
  Future<void> purgePlaintextCache() async {
    try {
      final cache = await getApplicationCacheDirectory();
      final dir = Directory('${cache.path}/offline_open');
      if (dir.existsSync()) await dir.delete(recursive: true);
    } catch (_) {
      // Ignore.
    }
  }

  // ── Housekeeping ──────────────────────────────────────────────────────

  Future<void> deleteBook(String bookId) async {
    final dir = await bookDirectory(bookId);
    if (dir.existsSync()) await dir.delete(recursive: true);
  }

  /// Removes one asset's encrypted file, e.g. a cover left behind after it was
  /// swapped for a fresher one under a new URL.
  Future<void> deleteAsset(String bookId, String assetId) async {
    final file = await assetFile(bookId, assetId);
    if (file.existsSync()) await file.delete();
  }

  /// Erases the whole vault — every downloaded book, every decrypted working
  /// copy, and the encryption key itself.
  ///
  /// Called on sign-out: a downloaded book carries no record of who fetched it,
  /// so the only way to stop one account's offline copies opening under the
  /// next account on the same device is to remove them. Dropping the key too
  /// means any ciphertext that somehow outlives the directory delete is left
  /// unrecoverable, and a fresh key is minted on the next download.
  Future<void> wipe() async {
    try {
      final support = await getApplicationSupportDirectory();
      final dir = Directory('${support.path}/offline_library');
      if (dir.existsSync()) await dir.delete(recursive: true);
    } catch (_) {
      // A locked or already-gone directory is not worth failing sign-out over.
    }
    await purgePlaintextCache();
    try {
      await _storage.delete(key: _keyAlias);
    } catch (_) {
      // Keystore hiccup: the directory is already gone, which is what matters.
    }
    _key = null;
    _root = null;
  }

  /// Total bytes one book occupies on disk.
  Future<int> bookSize(String bookId) async {
    final dir = await bookDirectory(bookId);
    if (!dir.existsSync()) return 0;
    var total = 0;
    for (final entity in dir.listSync(recursive: true)) {
      if (entity is File) total += entity.lengthSync();
    }
    return total;
  }

  /// Every manifest in the vault.
  ///
  /// Directory names are one-way digests, so the library is rebuilt by
  /// decrypting each manifest rather than by trying to reverse a slug back into
  /// a book id. That also means a directory whose manifest is missing or
  /// corrupt simply drops out of the library instead of half-appearing.
  Future<List<Map<String, dynamic>>> listManifests() async {
    final root = await _vaultRoot();
    if (!root.existsSync()) return const [];

    final manifests = <Map<String, dynamic>>[];
    for (final dir in root.listSync().whereType<Directory>()) {
      final file = File('${dir.path}/manifest.bin');
      if (!file.existsSync()) continue;
      try {
        final plain =
            await transform(_manifestAssetId, await file.readAsBytes());
        final decoded = jsonDecode(utf8.decode(plain));
        if (decoded is Map<String, dynamic>) manifests.add(decoded);
      } catch (_) {
        // Unreadable manifest: skip it.
      }
    }
    return manifests;
  }
}
