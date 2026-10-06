import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the student session (JWT pair + cached user record).
///
/// Stores credentials in encrypted secure storage with resilient fallback to
/// SharedPreferences to survive Android Keystore resets and iOS keychain locks.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                resetOnError: true,
              ),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  final FlutterSecureStorage _storage;

  static const _accessKey = 'accessToken';
  static const _refreshKey = 'refreshToken';
  static const _userKey = 'psc_user';

  // Live in-memory cache for hot path requests.
  String? _accessToken;
  String? _refreshToken;
  bool _hydrated = false;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  bool get hasSession => _accessToken != null && _accessToken!.isNotEmpty;

  Future<void> hydrate() async {
    if (_hydrated) return;
    try {
      _accessToken = await _storage.read(key: _accessKey);
      _refreshToken = await _storage.read(key: _refreshKey);
    } catch (e) {
      if (kDebugMode) debugPrint('SecureStorage read failed, falling back to prefs: $e');
    }

    if (_accessToken == null || _accessToken!.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        _accessToken = prefs.getString(_accessKey);
        _refreshToken = prefs.getString(_refreshKey);
      } catch (e) {
        if (kDebugMode) debugPrint('SharedPreferences read fallback failed: $e');
      }
    }

    _hydrated = true;
  }

  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    _accessToken = accessToken;
    try {
      await _storage.write(key: _accessKey, value: accessToken);
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_accessKey, accessToken);
    } catch (_) {}

    if (refreshToken != null && refreshToken.isNotEmpty) {
      _refreshToken = refreshToken;
      try {
        await _storage.write(key: _refreshKey, value: refreshToken);
      } catch (_) {}
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_refreshKey, refreshToken);
      } catch (_) {}
    }
  }

  Future<void> saveUser(Map<String, dynamic> user) async {
    final encoded = jsonEncode(user);
    try {
      await _storage.write(key: _userKey, value: encoded);
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userKey, encoded);
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> readUser() async {
    String? raw;
    try {
      raw = await _storage.read(key: _userKey);
    } catch (_) {}
    if (raw == null || raw.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        raw = prefs.getString(_userKey);
      } catch (_) {}
    }

    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    try {
      await Future.wait([
        _storage.delete(key: _accessKey),
        _storage.delete(key: _refreshKey),
        _storage.delete(key: _userKey),
      ]);
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_accessKey);
      await prefs.remove(_refreshKey);
      await prefs.remove(_userKey);
    } catch (_) {}
  }
}
