import 'package:dio/dio.dart';

/// A failure surfaced to the UI with a message worth showing a student.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.isNetwork = false});

  final String message;
  final int? statusCode;
  final bool isNetwork;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;

  /// Translates a Dio failure into something a student can act on. The Nest
  /// API returns `{ message: string | string[] }` on validation errors, which
  /// is the same shape the web client reads.
  factory ApiException.fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(
          'The server took too long to respond. Please try again.',
          isNetwork: true,
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return const ApiException(
          'No internet connection. Check your network and try again.',
          isNetwork: true,
        );
      case DioExceptionType.cancel:
        return const ApiException('Request cancelled.');
      case DioExceptionType.badCertificate:
        return const ApiException('Could not establish a secure connection.');
      case DioExceptionType.badResponse:
        break;
      // Newer Dio versions add transform failures; treat them as a generic
      // bad response rather than pinning this switch to one SDK version.
      default:
        break;
    }

    final response = error.response;
    final status = response?.statusCode;
    final data = response?.data;

    String? message;
    if (data is Map) {
      final raw = data['message'] ?? data['error'];
      if (raw is String) {
        message = raw;
      } else if (raw is List && raw.isNotEmpty) {
        message = raw.first.toString();
      }
    }

    return ApiException(
      message ?? _defaultFor(status),
      statusCode: status,
    );
  }

  static String _defaultFor(int? status) {
    switch (status) {
      case 400:
        return 'That request was not valid.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have access to this content.';
      case 404:
        return 'We could not find what you were looking for.';
      case 409:
        return 'That conflicts with something that already exists.';
      case 429:
        return 'Too many requests. Please slow down and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  @override
  String toString() => message;
}
