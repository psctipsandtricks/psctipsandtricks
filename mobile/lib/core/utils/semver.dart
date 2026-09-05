/// Semantic version helpers for the app-update feature.
///
/// Mirrors `apps/api/src/common/semver.ts` — every version compared here is
/// an Android `versionName` an admin typed in or the one this build was
/// compiled with, always `X.Y.Z`. Comparing those as strings would rank
/// "2.10.0" below "2.9.0"; comparing them as numeric segments does not.
class SemVer {
  const SemVer._();

  static final _pattern = RegExp(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$');

  static bool isValid(String version) => _pattern.hasMatch(version.trim());

  /// Negative if [a] < [b], zero if equal, positive if [a] > [b].
  ///
  /// Tolerant of a malformed version on either side (a stray build config, an
  /// installed version the store reports in some other shape): unparsed
  /// segments read as 0, so a bad string sorts as "0.0.0" rather than
  /// throwing — this runs on every launch and must never crash it.
  static int compare(String a, String b) {
    final partsA = _segments(a);
    final partsB = _segments(b);
    for (var i = 0; i < 3; i++) {
      final diff = partsA[i] - partsB[i];
      if (diff != 0) return diff;
    }
    return 0;
  }

  static bool isAtLeast(String version, String floor) => compare(version, floor) >= 0;
  static bool isBelow(String version, String floor) => compare(version, floor) < 0;

  static List<int> _segments(String version) {
    final raw = version.trim().split('.');
    return List.generate(3, (i) => i < raw.length ? (int.tryParse(raw[i]) ?? 0) : 0);
  }
}
