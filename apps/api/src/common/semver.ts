/**
 * Semantic version helpers for the app-update feature.
 *
 * Deliberately narrower than full semver (no pre-release/build metadata) —
 * every version this system ever compares is an Android `versionName` an
 * admin typed in, of the form `X.Y.Z`. Comparing those as strings would rank
 * "2.10.0" below "2.9.0"; comparing them as numeric segments does not.
 */

/** Exactly three non-negative integer segments, e.g. "2.6.0". No leading
 * zeros beyond a bare "0", so "2.06.0" is rejected rather than silently
 * accepted as "2.6.0". */
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isValidVersion(version: string): boolean {
  return typeof version === 'string' && VERSION_PATTERN.test(version.trim());
}

/** -1 if `a` < `b`, 0 if equal, 1 if `a` > `b`. Assumes both already passed
 * `isValidVersion` — callers validate at the boundary (DTOs), not here. */
export function compareVersions(a: string, b: string): number {
  const partsA = a.trim().split('.').map(Number);
  const partsB = b.trim().split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function isVersionAtLeast(version: string, floor: string): boolean {
  return compareVersions(version, floor) >= 0;
}
