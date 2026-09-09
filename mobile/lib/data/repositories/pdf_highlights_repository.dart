import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../../features/pdfs/annotations/pdf_highlight.dart';

/// The server's copy of a student's marker strokes.
///
/// Highlights live on the server so a mark made on the phone is on the website
/// too. The on-device store beside this is a cache, not the record.
class PdfHighlightsRepository {
  PdfHighlightsRepository(this._api);

  final ApiClient _api;

  Future<List<PdfHighlight>> fetch(String documentKey) async {
    final res = await _api.get<dynamic>(
      '/pdf-highlights',
      query: {'documentKey': documentKey},
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => pdfHighlightFromApi(Map<String, dynamic>.from(e)))
        .whereType<PdfHighlight>()
        .toList();
  }

  /// Saves one stroke and returns it as the server stored it — with the id the
  /// eraser will later quote, which is why the created row is read back rather
  /// than assumed.
  Future<PdfHighlight?> create(String documentKey, PdfHighlight highlight) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/pdf-highlights',
      body: {
        'documentKey': documentKey,
        'page': highlight.page,
        'points': [
          for (final p in highlight.points) ...[p.dx, p.dy],
        ],
        'color': highlight.colorValue,
        'width': highlight.width,
      },
    );
    return pdfHighlightFromApi(res);
  }

  /// A batch because one swipe of the eraser can cross several strokes.
  Future<void> erase(List<String> ids) async {
    if (ids.isEmpty) return;
    await _api.post<dynamic>('/pdf-highlights/erase', body: {'ids': ids});
  }
}
