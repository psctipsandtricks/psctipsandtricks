import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Identifies the plain cover drawn over a document while its route is
/// transitioning. Exported so a test can hold the behaviour in place: the
/// document is a native platform view, it cannot animate with the page, and
/// covering it is the only thing standing between a reader and a torn,
/// ghosting slide every time they open or leave one.
const documentTransitionCoverKey = ValueKey('reader-document-transition-cover');

/// Hides a PDF while it is not safe to look at.
///
/// `flutter_pdfview` draws through a native platform view. A native surface
/// does not travel with the Flutter layer during a page transition — sliding
/// one in tears, ghosts, or shows straight through to the screen behind — so
/// every route that renders a document has to cover it for the length of any
/// animation it is caught in. That is three separate cases, and missing any one
/// of them just moves the glitch somewhere else:
///
///  * this route arriving or leaving ([routeAnimation]);
///  * another route sliding over it, or off it again ([coveringAnimation]) —
///    the full-page audio player over the reader, say;
///  * one document being swapped for another underneath the same route
///    ([isLoading]), which tears the old native view down and builds a new one.
///
/// The first two get a plain page: they are over in a couple of hundred
/// milliseconds and a spinner would only flash. The third is a real wait for a
/// real document, so it says so.
class PdfTransitionCover extends StatelessWidget {
  const PdfTransitionCover({
    super.key,
    this.routeAnimation,
    this.coveringAnimation,
    this.isLoading = false,
    this.loadingLabel,
  });

  final Animation<double>? routeAnimation;
  final Animation<double>? coveringAnimation;

  /// A document is being replaced under this route.
  final bool isLoading;

  /// Shown under the spinner while [isLoading]. Null draws a bare cover.
  final String? loadingLabel;

  /// Reads the animations off the enclosing route, for the common case where
  /// the caller has no reason to hold them itself.
  factory PdfTransitionCover.of(
    BuildContext context, {
    bool isLoading = false,
    String? loadingLabel,
  }) {
    final route = ModalRoute.of(context);
    return PdfTransitionCover(
      routeAnimation: route?.animation,
      coveringAnimation: route?.secondaryAnimation,
      isLoading: isLoading,
      loadingLabel: loadingLabel,
    );
  }

  @override
  Widget build(BuildContext context) {
    final animations =
        [routeAnimation, coveringAnimation].nonNulls.toList(growable: false);
    if (animations.isEmpty) {
      return isLoading
          ? _cover(context, loading: true)
          : const SizedBox.shrink();
    }

    return AnimatedBuilder(
      animation: Listenable.merge(animations),
      builder: (context, _) {
        // Arriving or leaving: anything but "fully arrived" is mid-flight.
        final travelling = routeAnimation != null &&
            routeAnimation!.status != AnimationStatus.completed;
        // Being covered: anything but "nothing on top" is mid-flight.
        final beingCovered = coveringAnimation != null &&
            coveringAnimation!.status != AnimationStatus.dismissed;

        if (!travelling && !beingCovered && !isLoading) {
          return const SizedBox.shrink();
        }
        return _cover(
          context,
          loading: isLoading && !travelling && !beingCovered,
        );
      },
    );
  }

  Widget _cover(BuildContext context, {required bool loading}) {
    return ColoredBox(
      key: documentTransitionCoverKey,
      color: context.palette.background,
      child: loading && loadingLabel != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 34,
                    height: 34,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    loadingLabel!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.palette.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
