import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'pdf_highlight.dart';

/// Every student's marker strokes, kept apart from every other student's.
///
/// Highlights are personal marks on shared study material, so the store is
/// partitioned by user id: two people sharing a device see only their own, and
/// signing out takes a student's marks off the device with everything else that
/// belonged to them ([clear] runs from `clearAccountScopedState`).
///
/// A plain JSON file per document, under the app-private support directory —
/// the same shape as the community cache. One document's highlights are a few
/// hundred points at most, which is cheaper to read whole than to index.
///
/// This is on-device storage. Highlights do not follow a student to a second
/// phone or survive a reinstall; that needs a table on the server, and this
/// class is deliberately the only thing the rest of the app talks to so that
/// can be added behind it without touching the drawing code.
class PdfHighlightStore {
  PdfHighlightStore();

  /// Bumped when the stored shape changes; older files are discarded rather
  /// than parsed.
  static const _schemaVersion = 1;

  static const _dirName = 'pdf_highlights';

  Directory? _root;

  /// Serializes writes per file, so two strokes finished in quick succession
  /// cannot interleave into unparseable JSON.
  final _writeQueue = <String, Future<void>>{};

  Future<Directory?> _directory() async {
    final cached = _root;
    if (cached != null) return cached;
    try {
      final support = await getApplicationSupportDirectory();
      final dir = Directory('${support.path}/$_dirName');
      if (!dir.existsSync()) dir.createSync(recursive: true);
      return _root = dir;
    } catch (e) {
      _log('could not open the highlight directory: $e');
      return null;
    }
  }

  /// One file per user per document. The user id is part of the path rather
  /// than the contents, so one student's file can never be read for another.
  String _fileName(String userId, String documentUrl) {
    final user = userId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    return '${user}__${pdfHighlightKey(documentUrl)}.json';
  }

  /// This student's strokes on this document, oldest first. Empty for anything
  /// missing, corrupt or written by an older format.
  Future<List<PdfHighlight>> load(String userId, String documentUrl) async {
    if (userId.isEmpty) return const [];
    final dir = await _directory();
    if (dir == null) return const [];

    try {
      final file = File('${dir.path}/${_fileName(userId, documentUrl)}');
      if (!file.existsSync()) return const [];

      final decoded = jsonDecode(await file.readAsString());
      if (decoded is! Map || decoded['v'] != _schemaVersion) return const [];

      final rows = decoded['highlights'];
      if (rows is! List) return const [];

      // A stroke that will not parse is skipped, not fatal: losing one mark is
      // better than losing the page.
      return rows
          .whereType<Map>()
          .map((e) => PdfHighlight.fromJson(Map<String, dynamic>.from(e)))
          .whereType<PdfHighlight>()
          .toList();
    } catch (e) {
      _log('could not read highlights: $e');
      return const [];
    }
  }

  /// Replaces this student's strokes on this document.
  ///
  /// The whole set is rewritten rather than appended to, which is what makes an
  /// erase as durable as a draw — the file is the truth, so a stroke that is
  /// gone from [highlights] is gone from disk.
  Future<void> save(
    String userId,
    String documentUrl,
    List<PdfHighlight> highlights,
  ) {
    if (userId.isEmpty) return Future.value();
    final name = _fileName(userId, documentUrl);

    final pending = (_writeQueue[name] ?? Future<void>.value()).then((_) async {
      final dir = await _directory();
      if (dir == null) return;
      try {
        final path = '${dir.path}/$name';
        if (highlights.isEmpty) {
          // Nothing left to remember: take the file away rather than leaving an
          // empty one behind for every document ever opened.
          final file = File(path);
          if (file.existsSync()) await file.delete();
          return;
        }

        final payload = jsonEncode({
          'v': _schemaVersion,
          'savedAt': DateTime.now().toUtc().toIso8601String(),
          'highlights': [for (final h in highlights) h.toJson()],
        });
        // Write beside and rename, so an app kill mid-write leaves the previous
        // good file rather than a truncated one.
        final temp = File('$path.tmp');
        await temp.writeAsString(payload, flush: true);
        await temp.rename(path);
      } catch (e) {
        _log('could not write highlights: $e');
      }
    });

    _writeQueue[name] = pending;
    return pending.whenComplete(() {
      if (identical(_writeQueue[name], pending)) _writeQueue.remove(name);
    });
  }

  /// Drops every student's highlights on this device. Called on sign-out, where
  /// everything else account-scoped goes too.
  Future<void> clear() async {
    final dir = await _directory();
    if (dir == null) return;
    try {
      if (dir.existsSync()) await dir.delete(recursive: true);
    } catch (e) {
      _log('could not clear highlights: $e');
    } finally {
      _root = null;
      _writeQueue.clear();
    }
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('PdfHighlightStore: $message');
  }
}
