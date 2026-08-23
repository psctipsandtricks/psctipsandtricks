import 'dart:convert';

/// Defensive readers for API payloads.
///
/// Prisma serialises decimals as strings and omits nullable relations, so a
/// field's runtime type is not always what the TypeScript definition implies.
/// Every model parses through these rather than casting directly.
class J {
  const J._();

  static String str(dynamic v, [String fallback = '']) =>
      v == null ? fallback : v.toString();

  static String? strOrNull(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    return s.isEmpty ? null : s;
  }

  static int intVal(dynamic v, [int fallback = 0]) {
    if (v is int) return v;
    if (v is double) return v.round();
    if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.round() ?? fallback;
    return fallback;
  }

  static int? intOrNull(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is double) return v.round();
    if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.round();
    return null;
  }

  static double dbl(dynamic v, [double fallback = 0]) {
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? fallback;
    return fallback;
  }

  static double? dblOrNull(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  static bool boolVal(dynamic v, [bool fallback = false]) {
    if (v is bool) return v;
    if (v is num) return v != 0;
    if (v is String) return v == 'true' || v == '1';
    return fallback;
  }

  static DateTime? dateOrNull(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse(v.toString())?.toLocal();
  }

  static DateTime date(dynamic v) => dateOrNull(v) ?? DateTime.fromMillisecondsSinceEpoch(0);

  static Map<String, dynamic> map(dynamic v) => mapOrNull(v) ?? <String, dynamic>{};

  static Map<String, dynamic>? mapOrNull(dynamic v) {
    if (v == null) return null;
    if (v is Map) return Map<String, dynamic>.from(v);
    if (v is String) {
      final trimmed = v.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          final decoded = jsonDecode(trimmed);
          if (decoded is Map) return Map<String, dynamic>.from(decoded);
        } catch (_) {}
      }
    }
    return null;
  }

  /// Parses a JSON array into models, skipping entries that are not objects.
  static List<T> list<T>(dynamic v, T Function(Map<String, dynamic>) parse) {
    if (v is! List) return const [];
    return v
        .whereType<Map>()
        .map((e) => parse(Map<String, dynamic>.from(e)))
        .toList(growable: false);
  }

  /// Unwraps a paginated envelope (`{ data: [...] }`) or a bare array — the
  /// API uses both shapes depending on the endpoint.
  static List<dynamic> rows(dynamic v) {
    if (v is List) return v;
    if (v is Map) {
      for (final key in const ['data', 'items', 'results', 'rows']) {
        final inner = v[key];
        if (inner is List) return inner;
      }
    }
    return const [];
  }
}
