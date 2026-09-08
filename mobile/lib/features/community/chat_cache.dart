import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../../data/models/chat.dart';

/// On-disk cache of the community's group list and each group's recent
/// messages.
///
/// Opening the Community tab used to mean an empty screen until two round trips
/// finished — the group list, then that group's history. Everything here exists
/// so the second visit paints from the last known state immediately and the
/// network response only has to *correct* what is already on screen.
///
/// It is deliberately a plain JSON-file store rather than a database: the whole
/// working set is one list of groups plus a screenful of messages per group, so
/// the read is a single file the app can afford to parse during startup, and
/// there is no schema to migrate when a message field changes.
///
/// The cache is account-scoped by nothing but its lifetime — group membership,
/// unread counts and history are all specific to the signed-in student, so
/// [clear] must run on sign-out. `clearAccountScopedState` does that.
class ChatCache {
  ChatCache();

  /// Bumped when the stored shape changes; older files are discarded rather
  /// than parsed, so a released format change can never surface as a crash on
  /// somebody's leftover cache.
  static const _schemaVersion = 1;

  /// Enough to fill the first screen and a few scrolls back without making the
  /// file big enough to be slow to parse.
  static const messageLimit = 60;

  /// Beyond this the cached copy is likely to be more confusing than helpful,
  /// so it is dropped and the screen waits for the network like a first run.
  static const maxAge = Duration(days: 7);

  static const _dirName = 'chat_cache';
  static const _groupsFile = 'groups.json';

  Directory? _root;

  /// Serializes writes per file. Two messages arriving together would otherwise
  /// race to rewrite the same group's history and could interleave into
  /// unparseable JSON.
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
      // A cache is an optimisation — if the platform will not give us a
      // directory, every read below degrades to "nothing cached".
      _log('could not open cache directory: $e');
      return null;
    }
  }

  String _messagesFile(String groupId) {
    // Group ids are UUIDs, but never trust an id straight into a path.
    final safe = groupId.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    return 'messages_$safe.json';
  }

  /// Reads one cached list, returning null for missing, stale, corrupt or
  /// wrong-version files — the caller treats all of those the same way.
  Future<List<dynamic>?> _read(String fileName) async {
    final dir = await _directory();
    if (dir == null) return null;

    try {
      final file = File('${dir.path}/$fileName');
      if (!file.existsSync()) return null;

      final decoded = jsonDecode(await file.readAsString());
      if (decoded is! Map) return null;
      if (decoded['v'] != _schemaVersion) return null;

      final savedAt = DateTime.tryParse('${decoded['savedAt']}');
      if (savedAt == null || DateTime.now().difference(savedAt) > maxAge) {
        unawaited(file.delete());
        return null;
      }

      final data = decoded['data'];
      return data is List ? data : null;
    } catch (e) {
      _log('could not read $fileName: $e');
      return null;
    }
  }

  Future<void> _write(String fileName, List<Map<String, dynamic>> data) {
    // Chain onto whatever write is already in flight for this file.
    final pending = (_writeQueue[fileName] ?? Future<void>.value()).then((_) async {
      final dir = await _directory();
      if (dir == null) return;
      try {
        final payload = jsonEncode({
          'v': _schemaVersion,
          'savedAt': DateTime.now().toIso8601String(),
          'data': data,
        });
        // Write to a sibling and rename, so an app kill mid-write leaves the
        // previous good cache in place rather than a truncated file.
        final temp = File('${dir.path}/$fileName.tmp');
        await temp.writeAsString(payload, flush: true);
        await temp.rename('${dir.path}/$fileName');
      } catch (e) {
        _log('could not write $fileName: $e');
      }
    });

    _writeQueue[fileName] = pending;
    return pending.whenComplete(() {
      if (identical(_writeQueue[fileName], pending)) _writeQueue.remove(fileName);
    });
  }

  /// The group list as of the last successful fetch, or null if there is none
  /// worth showing.
  Future<List<ChatGroup>?> readGroups() async {
    final rows = await _read(_groupsFile);
    if (rows == null) return null;
    try {
      final groups = rows
          .whereType<Map>()
          .map((e) => ChatGroup.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      return groups.isEmpty ? null : groups;
    } catch (e) {
      _log('could not parse cached groups: $e');
      return null;
    }
  }

  Future<void> writeGroups(List<ChatGroup> groups) =>
      _write(_groupsFile, groups.map((g) => g.toJson()).toList());

  /// One group's cached history, newest first — the same order the chat screen
  /// keeps it in.
  Future<List<ChatMessage>?> readMessages(String groupId) async {
    final rows = await _read(_messagesFile(groupId));
    if (rows == null) return null;
    try {
      final messages = rows
          .whereType<Map>()
          .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      return messages.isEmpty ? null : messages;
    } catch (e) {
      _log('could not parse cached messages for $groupId: $e');
      return null;
    }
  }

  /// Stores the newest [messageLimit] of [messages], which must be newest-first.
  ///
  /// Only the newest page is kept: older pages are cheap to re-fetch on demand
  /// and there is no point growing this file for history nobody scrolls back to
  /// twice.
  Future<void> writeMessages(String groupId, List<ChatMessage> messages) {
    final recent = messages.take(messageLimit).map((m) => m.toJson()).toList();
    return _write(_messagesFile(groupId), recent);
  }

  /// Drops everything. Called when an account signs out, since group
  /// membership, unread counts and message history all belong to that student.
  Future<void> clear() async {
    final dir = await _directory();
    if (dir == null) return;
    try {
      if (dir.existsSync()) await dir.delete(recursive: true);
    } catch (e) {
      _log('could not clear chat cache: $e');
    } finally {
      _root = null;
      _writeQueue.clear();
    }
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('ChatCache: $message');
  }
}
