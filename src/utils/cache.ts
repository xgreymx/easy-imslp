/**
 * Cache entry with timestamp for TTL expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;

  /**
   * Create a new cache
   * @param ttlMs Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  /**
   * Get a value from cache
   * @returns The cached value or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store a value in cache
   */
  set(key: string, value: T): void {
    this.store.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of entries in cache (including expired)
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Remove all expired entries from cache
   * Call periodically to prevent memory leaks in long-running processes
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.store) {
      if (now - entry.timestamp > this.ttl) {
        this.store.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get or set a value using a factory function
   * If the key exists and is not expired, returns cached value
   * Otherwise, calls the factory, caches the result, and returns it
   */
  async getOrSet(key: string, factory: () => T | Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }
}

/**
 * Create a cache key from multiple parts
 * Handles objects by JSON stringifying them
 */
export function createCacheKey(prefix: string, ...parts: unknown[]): string {
  const serialized = parts.map((part) => {
    if (part === null || part === undefined) {
      return '';
    }
    if (typeof part === 'object') {
      return JSON.stringify(part);
    }
    return String(part);
  });

  return `${prefix}:${serialized.join(':')}`;
}

/**
 * Hash a string for cache keys (simple FNV-1a)
 */
export function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
