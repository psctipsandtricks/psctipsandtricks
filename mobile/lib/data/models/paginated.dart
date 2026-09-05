import '../../core/utils/json.dart';

/// A single page of a numbered-pagination endpoint.
///
/// The API returns `{ data: [...], total, page, limit, totalPages }` once a
/// caller opts into pagination with `page`/`limit`. A bare array (an endpoint
/// that has not opted in, or an older server) degrades to a single page.
class Paginated<T> {
  const Paginated({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
    required this.pageSize,
  });

  final List<T> items;
  final int page;
  final int totalPages;
  final int totalItems;
  final int pageSize;

  bool get isEmpty => items.isEmpty;
  bool get hasMultiplePages => totalPages > 1;

  /// 1-based index of the first item on this page, for a "showing X–Y of Z" line.
  int get firstItemIndex => totalItems == 0 ? 0 : (page - 1) * pageSize + 1;
  int get lastItemIndex => firstItemIndex == 0 ? 0 : firstItemIndex + items.length - 1;

  factory Paginated.fromJson(
    dynamic json,
    T Function(Map<String, dynamic>) parse,
  ) {
    final rows = J.rows(json);
    final items = rows
        .whereType<Map>()
        .map((e) => parse(Map<String, dynamic>.from(e)))
        .toList();
    final meta = J.mapOrNull(json) ?? const {};
    final total = J.intVal(meta['total'], items.length);
    final size = J.intVal(meta['limit'], items.isEmpty ? 1 : items.length);
    return Paginated(
      items: items,
      page: J.intVal(meta['page'], 1),
      totalPages: J.intVal(meta['totalPages'], 1),
      totalItems: total,
      pageSize: size < 1 ? 1 : size,
    );
  }

  Paginated<T> copyWith({List<T>? items}) => Paginated(
        items: items ?? this.items,
        page: page,
        totalPages: totalPages,
        totalItems: totalItems,
        pageSize: pageSize,
      );
}
