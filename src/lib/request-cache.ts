/**
 * Bounded request cache with TTL expiry, LRU eviction and in-flight dedup.
 *
 * Integration contract (consumers integrate in their own lanes):
 * - Reads only: attendance read paths (getAttendanceHistoryPage and the
 *   bounded records fetch) may route through `getOrLoad`. Mutations
 *   (clock-in / clock-out) must never be cached; after a mutation call
 *   `invalidate`, `invalidateWhere` or `clear` so converging reads observe
 *   fresh state.
 * - Recent-events reads want a SHORT TTL (e.g. 5s) so the focus-refresh
 *   primitive (useAttendanceFocusRefresh) stays fresh; history pages can use
 *   a longer TTL via the per-call `ttlMs` override.
 * - Build keys with `createRequestKey` from the RPC name plus the exact RPC
 *   params; keys are deterministic regardless of property insertion order.
 * - Rejections are never cached: a failed load is removed from the cache, so
 *   the next read retries the underlying call.
 */

export interface RequestCacheOptions {
  /** Hard cap on stored entries; 0 disables caching (pass-through). Default 100. */
  maxEntries?: number;
  /** TTL for entries without a per-call override. Default 30_000 ms. */
  defaultTtlMs?: number;
  /** Injectable clock for deterministic TTL tests. Defaults to Date.now. */
  now?: () => number;
}

interface RequestCacheEntry {
  promise: Promise<unknown>;
  expiresAt: number;
  lastUsedAt: number;
}

function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();

    return `{${sortedKeys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

/** Builds a deterministic cache key from an RPC name and its params. */
export function createRequestKey(
  rpcName: string,
  params: Record<string, unknown>,
): string {
  return `${rpcName}(${stableSerialize(params)})`;
}

export class RequestCache {
  private readonly entries = new Map<string, RequestCacheEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private readonly now: () => number;

  constructor(options: RequestCacheOptions = {}) {
    this.maxEntries = Math.max(0, options.maxEntries ?? 100);
    this.defaultTtlMs = Math.max(0, options.defaultTtlMs ?? 30_000);
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the cached in-flight/resolved promise for `key`, or loads it.
   * Concurrent callers with the same key share a single underlying load.
   */
  getOrLoad<T>(
    key: string,
    load: () => Promise<T> | T,
    options: { ttlMs?: number } = {},
  ): Promise<T> {
    const now = this.now();
    const existing = this.entries.get(key);

    if (existing && existing.expiresAt > now) {
      existing.lastUsedAt = now;
      this.entries.delete(key);
      this.entries.set(key, existing);

      return existing.promise as Promise<T>;
    }

    if (existing) {
      this.entries.delete(key);
    }

    const ttlMs = Math.max(0, options.ttlMs ?? this.defaultTtlMs);
    const promise = Promise.resolve().then(load);
    const entry: RequestCacheEntry = {
      promise,
      expiresAt: now + ttlMs,
      lastUsedAt: now,
    };

    promise.catch(() => {
      if (this.entries.get(key) === entry) {
        this.entries.delete(key);
      }
    });

    this.entries.set(key, entry);
    this.evictLeastRecentlyUsed();

    return promise as Promise<T>;
  }

  /** Removes a single key. In-flight callers still receive their result. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  /** Removes every key matching the predicate (e.g. an RPC-name prefix). */
  invalidateWhere(predicate: (key: string) => boolean): void {
    for (const key of this.entries.keys()) {
      if (predicate(key)) {
        this.entries.delete(key);
      }
    }
  }

  /** Removes every entry. */
  clear(): void {
    this.entries.clear();
  }

  private evictLeastRecentlyUsed(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }
}
