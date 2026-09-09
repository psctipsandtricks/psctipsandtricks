import 'dart:ui' show PointMode;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';

import 'pdf_highlight.dart';

/// Which annotation tool the student has picked up, if any.
enum PdfAnnotationTool {
  /// Neither: touches belong to the document, which scrolls and zooms as usual.
  none,
  marker,
  eraser,
}

/// The marker and eraser, drawn over the document.
///
/// Sits above `flutter_pdfview`'s native view. That layering is what makes the
/// tools possible at all: the native viewer owns its own gestures, so the only
/// way to draw on it is to put a Flutter surface in front and take the touches
/// away while a tool is in hand. With [PdfAnnotationTool.none] the layer is
/// invisible to hit-testing and the document behaves exactly as before.
class PdfAnnotationLayer extends StatefulWidget {
  const PdfAnnotationLayer({
    super.key,
    required this.tool,
    required this.viewport,
    required this.pageCount,
    required this.highlights,
    required this.onHighlightAdded,
    required this.onHighlightsErased,
    this.color = kDefaultHighlightColor,
  });

  final PdfAnnotationTool tool;

  /// Where the document currently sits, as a listenable rather than a value.
  ///
  /// This is what keeps the marks glued to the page. The painter takes it as
  /// its own `repaint` signal, so a scroll repaints the strokes directly
  /// without a rebuild or a layout pass — the frame that learns the document
  /// moved is the frame that redraws the highlights on it. Passing a plain
  /// value meant a `setState` per scroll event, and the extra pass was visible
  /// as the marks lagging behind the text.
  ///
  /// Holds null until the viewer has reported a position, which is when drawing
  /// would have nothing to anchor to.
  final ValueListenable<PdfViewport?> viewport;

  final int pageCount;
  final List<PdfHighlight> highlights;

  final ValueChanged<PdfHighlight> onHighlightAdded;

  /// Erasing is reported as a set rather than one at a time: a single swipe of
  /// the eraser can cross several strokes, and the page should lose them
  /// together rather than in a stutter of rebuilds.
  final ValueChanged<Set<String>> onHighlightsErased;

  final int color;

  @override
  State<PdfAnnotationLayer> createState() => _PdfAnnotationLayerState();
}

class _PdfAnnotationLayerState extends State<PdfAnnotationLayer> {
  /// The stroke under the finger right now, in page fractions. Kept separate
  /// from the saved list so the line appears as it is drawn and is only handed
  /// over once it is finished.
  final List<Offset> _wet = [];

  /// The page the current stroke started on. A stroke belongs to one page: a
  /// drag that wanders onto the next one is clipped rather than split, because
  /// half a highlight on each of two pages is not what anybody drew.
  int? _wetPage;

  /// Strokes the eraser has crossed during this drag, reported on release.
  final Set<String> _erased = {};

  bool get _active => widget.tool != PdfAnnotationTool.none;

  PdfPagePoint? _resolve(Offset local) {
    final viewport = widget.viewport.value;
    if (viewport == null) return null;
    return pdfPointFromScreen(local, viewport, pageCount: widget.pageCount);
  }

  void _startStroke(Offset local) {
    final at = _resolve(local);
    if (at == null) return;
    setState(() {
      _wetPage = at.page;
      _wet
        ..clear()
        ..add(at.position);
    });
  }

  void _extendStroke(Offset local) {
    final at = _resolve(local);
    if (at == null || at.page != _wetPage) return;
    setState(() => _wet.add(at.position));
  }

  void _endStroke() {
    final page = _wetPage;
    if (page == null || _wet.isEmpty) {
      setState(() {
        _wet.clear();
        _wetPage = null;
      });
      return;
    }

    final points = thinStrokePoints(clampToPage(_wet));
    setState(() {
      _wet.clear();
      _wetPage = null;
    });

    widget.onHighlightAdded(
      PdfHighlight(
        id: 'hl-${DateTime.now().microsecondsSinceEpoch}',
        page: page,
        points: points,
        colorValue: widget.color,
        width: kDefaultHighlightWidth,
        createdAt: DateTime.now(),
      ),
    );
  }

  void _eraseAt(Offset local) {
    final at = _resolve(local);
    if (at == null) return;
    for (final highlight in widget.highlights) {
      if (_erased.contains(highlight.id)) continue;
      if (eraserHitsHighlight(highlight, at.page, at.position)) {
        _erased.add(highlight.id);
      }
    }
    // Repaint so a rubbed-out stroke disappears under the finger rather than
    // when it lifts.
    if (_erased.isNotEmpty) setState(() {});
  }

  void _endErase() {
    if (_erased.isEmpty) return;
    final removed = Set<String>.from(_erased);
    _erased.clear();
    widget.onHighlightsErased(removed);
  }

  @override
  Widget build(BuildContext context) {
    final painter = CustomPaint(
      painter: _HighlightPainter(
        highlights: widget.highlights,
        viewport: widget.viewport,
        // Hidden the moment the eraser touches them, so the page shows what
        // lifting the finger will leave behind.
        hidden: _erased,
        wet: _wet,
        wetPage: _wetPage,
        wetColor: Color(widget.color),
      ),
      size: Size.infinite,
    );

    if (!_active) {
      // No tool in hand: the layer is a pane of glass. Touches go straight
      // through to the document, which scrolls and zooms as it always did.
      return IgnorePointer(child: painter);
    }

    final isMarker = widget.tool == PdfAnnotationTool.marker;
    return GestureDetector(
      // Opaque so every touch inside the document area is ours — a translucent
      // hit test would let the native viewer scroll the page out from under a
      // half-drawn stroke.
      behavior: HitTestBehavior.opaque,
      // `onPanDown` rather than `onPanStart`: a pan is not recognised until the
      // finger has travelled the touch slop, about 18 logical pixels, so
      // starting there would drop the first few millimetres of every stroke and
      // begin the highlight slightly to the side of where it was aimed.
      onPanDown: (d) =>
          isMarker ? _startStroke(d.localPosition) : _eraseAt(d.localPosition),
      onPanUpdate: (d) =>
          isMarker ? _extendStroke(d.localPosition) : _eraseAt(d.localPosition),
      onPanEnd: (_) => isMarker ? _endStroke() : _endErase(),
      // A touch that goes down and straight back up never becomes a pan, so it
      // arrives here instead — one dot of marker, or a poke at a highlight.
      onPanCancel: () => isMarker ? _endStroke() : _endErase(),
      child: MouseRegion(
        cursor: SystemMouseCursors.precise,
        child: painter,
      ),
    );
  }
}

class _HighlightPainter extends CustomPainter {
  _HighlightPainter({
    required this.highlights,
    required this.viewport,
    required this.hidden,
    required this.wet,
    required this.wetPage,
    required this.wetColor,
    // Repainting straight off the viewport is the whole point: the painter is
    // told the document moved and redraws, with no widget in between.
  }) : super(repaint: viewport);

  final List<PdfHighlight> highlights;
  final ValueListenable<PdfViewport?> viewport;
  final Set<String> hidden;
  final List<Offset> wet;
  final int? wetPage;
  final Color wetColor;

  @override
  void paint(Canvas canvas, Size size) {
    final viewport = this.viewport.value;
    if (viewport == null || !viewport.isUsable) return;

    // Nothing is drawn outside the document area — a stroke near the top of a
    // page must not bleed over the app bar or the audio strip.
    canvas.clipRect(Offset.zero & size);

    for (final highlight in highlights) {
      if (hidden.contains(highlight.id)) continue;
      _paintStroke(
        canvas,
        size,
        viewport,
        highlight.page,
        highlight.points,
        highlight.color,
        highlight.width,
      );
    }

    if (wetPage != null && wet.isNotEmpty) {
      _paintStroke(
        canvas,
        size,
        viewport,
        wetPage!,
        wet,
        wetColor,
        kDefaultHighlightWidth,
      );
    }
  }

  void _paintStroke(
    Canvas canvas,
    Size size,
    PdfViewport viewport,
    int page,
    List<Offset> points,
    Color color,
    double width,
  ) {
    final screen = [
      for (final p in points) pdfPointToScreen(page, p, viewport),
    ];

    // A stroke scrolled off the screen still costs a path to build; skipping it
    // is what keeps a heavily marked-up book smooth to scroll.
    final top = screen.map((p) => p.dy).reduce((a, b) => a < b ? a : b);
    final bottom = screen.map((p) => p.dy).reduce((a, b) => a > b ? a : b);
    final margin = width * viewport.pageWidth;
    if (bottom < -margin || top > size.height + margin) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = width * viewport.pageWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      // A highlighter darkens what is under it rather than covering it, which
      // is the whole point of one — the words have to stay readable.
      ..blendMode = BlendMode.multiply;

    if (screen.length == 1) {
      canvas.drawPoints(PointMode.points, screen, paint);
      return;
    }

    final path = Path()..moveTo(screen.first.dx, screen.first.dy);
    for (var i = 1; i < screen.length; i++) {
      path.lineTo(screen[i].dx, screen[i].dy);
    }
    canvas.drawPath(path, paint);
  }

  // Movement is handled by the `repaint` listenable above, so this only has to
  // catch the things a rebuild brings: strokes added, erased, or being drawn.
  @override
  bool shouldRepaint(_HighlightPainter old) =>
      !identical(old.viewport, viewport) ||
      !identical(old.highlights, highlights) ||
      old.highlights.length != highlights.length ||
      old.hidden.length != hidden.length ||
      old.wet.length != wet.length ||
      old.wetPage != wetPage;
}
