import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

/// The single HTTP entry point to the existing NestJS API.
///
/// Mirrors the web client's contract: bearer auth from the stored access token,
/// a one-shot refresh-and-retry on 401, and a hard session drop when the
/// refresh token is itself dead.
class ApiClient {
  ApiClient({required TokenStore tokenStore, Dio? dio})
      : _tokenStore = tokenStore,
        _dio = dio ?? Dio() {
    _dio.options = _dio.options.copyWith(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      contentType: Headers.jsonContentType,
      // Let every status through to the interceptor so a 401 can be retried
      // rather than thrown before we get a chance to refresh.
      validateStatus: (status) => status != null && status < 500,
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          await _tokenStore.hydrate();
          final token = _tokenStore.accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          final status = response.statusCode ?? 0;
          if (status >= 200 && status < 300) {
            handler.next(response);
            return;
          }
          handler.reject(
            DioException.badResponse(
              statusCode: status,
              requestOptions: response.requestOptions,
              response: response,
            ),
          );
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(onError: (error, handler) => _onError(error, handler)),
    );
  }

  final Dio _dio;
  final TokenStore _tokenStore;

  /// Fires when the stored session is unusable and could not be refreshed, so
  /// the auth layer can drop the user back to a signed-out state.
  final StreamController<void> _sessionExpired =
      StreamController<void>.broadcast();
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  // Concurrent 401s must not each burn the refresh token. The first failure
  // starts the refresh; every other request awaits the same future.
  Future<String?>? _refreshInFlight;

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final status = error.response?.statusCode;
    final path = error.requestOptions.path;
    final hadToken = (_tokenStore.accessToken ?? '').isNotEmpty;

    // A 401 from /auth/* is a bad credential, not an expired session — there is
    // nothing to refresh, so let it surface as-is.
    final refreshable =
        status == 401 && hadToken && !path.startsWith('/auth/');

    if (!refreshable) {
      handler.next(error);
      return;
    }

    final newToken = await _refreshAccessToken();
    if (newToken == null) {
      await _tokenStore.clear();
      if (!_sessionExpired.isClosed) _sessionExpired.add(null);
      handler.next(error);
      return;
    }

    try {
      final retried = await _retry(error.requestOptions, newToken);
      handler.resolve(retried);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions options, String token) {
    return _dio.fetch<dynamic>(
      options..headers['Authorization'] = 'Bearer $token',
    );
  }

  Future<String?> _refreshAccessToken() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _performRefresh() async {
    final refreshToken = _tokenStore.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return null;

    try {
      // A bare Dio instance: the interceptor chain would attach the dead access
      // token and recurse into another refresh on failure.
      final bare = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: AppConfig.connectTimeout,
          receiveTimeout: AppConfig.receiveTimeout,
          contentType: Headers.jsonContentType,
        ),
      );
      final res = await bare.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final access = res.data?['accessToken'] as String?;
      if (access == null || access.isEmpty) return null;
      await _tokenStore.saveTokens(
        accessToken: access,
        refreshToken: res.data?['refreshToken'] as String?,
      );
      return access;
    } catch (e) {
      if (kDebugMode) debugPrint('Token refresh failed: $e');
      return null;
    }
  }

  // ── Verbs ──────────────────────────────────────────────────────────────

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) =>
      _send<T>(() => _dio.get<T>(
            path,
            queryParameters: _clean(query),
            cancelToken: cancelToken,
          ));

  Future<T> post<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) =>
      _send<T>(() => _dio.post<T>(
            path,
            data: body,
            queryParameters: _clean(query),
            cancelToken: cancelToken,
          ));

  Future<T> patch<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.patch<T>(path, data: body));

  Future<T> put<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.put<T>(path, data: body));

  Future<T> delete<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.delete<T>(path, data: body));

  /// Multipart upload used by avatar and chat-attachment endpoints, which all
  /// take a single `file` field.
  Future<T> upload<T>(
    String path, {
    required String filePath,
    String field = 'file',
    void Function(int sent, int total)? onProgress,
  }) async {
    final form = FormData.fromMap({
      field: await MultipartFile.fromFile(filePath),
    });
    return _send<T>(
      () => _dio.post<T>(path, data: form, onSendProgress: onProgress),
    );
  }

  /// Streams a remote file to disk — used to hand PDFs to the native viewer.
  Future<void> download(
    String url,
    String savePath, {
    void Function(int received, int total)? onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      await _dio.download(
        url,
        savePath,
        onReceiveProgress: onProgress,
        cancelToken: cancelToken,
        options: Options(headers: _authHeader()),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Map<String, String> _authHeader() {
    final token = _tokenStore.accessToken;
    return token == null || token.isEmpty
        ? const {}
        : {'Authorization': 'Bearer $token'};
  }

  Future<T> _send<T>(Future<Response<T>> Function() request) async {
    try {
      final res = await request();
      return res.data as T;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Drops null query values so optional filters never serialise as `key=null`.
  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final cleaned = <String, dynamic>{};
    query.forEach((key, value) {
      if (value != null) cleaned[key] = value;
    });
    return cleaned.isEmpty ? null : cleaned;
  }

  void dispose() {
    _sessionExpired.close();
    _dio.close(force: true);
  }
}
