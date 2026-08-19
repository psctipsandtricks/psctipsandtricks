/**
 * A tiny process-local, in-memory cache with per-entry TTL — for memoizing an
 * expensive read (e.g. a dashboard aggregate) for a short window without
 * pulling in an external cache/Redis dependency. Not shared across instances;
 * fine for smoothing repeated hits on a single API process.
 */
export class TtlCache<T = unknown> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
