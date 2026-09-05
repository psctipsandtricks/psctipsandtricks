/**
 * Semantic version helpers for the App Update Settings form — mirrors
 * `apps/api/src/common/semver.ts`. Kept as a small standalone copy rather
 * than a shared package import: the two run in different processes and the
 * rule is tiny enough that duplicating it costs less than wiring up a shared
 * runtime dependency for one function.
 */

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isValidVersion(version: string): boolean {
  return VERSION_PATTERN.test(version.trim());
}

/** -1 if `a` < `b`, 0 if equal, 1 if `a` > `b`. Numeric per segment, so
 * "2.10.0" correctly sorts above "2.9.0" rather than below it. */
export function compareVersions(a: string, b: string): number {
  const partsA = a.trim().split('.').map(Number);
  const partsB = b.trim().split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
