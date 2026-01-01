import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cache, createCacheKey, hashString } from '../../src/utils/cache.js';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>(1000); // 1 second TTL for tests
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new Cache<string>(50); // 50ms TTL
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(shortCache.get('key1')).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      const shortCache = new Cache<string>(100);
      shortCache.set('key1', 'value1');

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(shortCache.get('key1')).toBe('value1');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false for missing keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return the number of entries', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', async () => {
      const shortCache = new Cache<string>(50);
      shortCache.set('key1', 'value1');
      shortCache.set('key2', 'value2');

      await new Promise((resolve) => setTimeout(resolve, 60));

      shortCache.set('key3', 'value3'); // This one is fresh

      const pruned = shortCache.prune();
      expect(pruned).toBe(2);
      expect(shortCache.size).toBe(1);
      expect(shortCache.get('key3')).toBe('value3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached');
      const factory = vi.fn(() => 'new');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = vi.fn(() => 'new');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('new');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('new');
    });

    it('should handle async factories', async () => {
      const factory = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async value';
      });

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('async value');
      expect(cache.get('key1')).toBe('async value');
    });
  });
});

describe('createCacheKey', () => {
  it('should create keys from strings', () => {
    expect(createCacheKey('prefix', 'a', 'b')).toBe('prefix:a:b');
  });

  it('should handle numbers', () => {
    expect(createCacheKey('prefix', 123, 456)).toBe('prefix:123:456');
  });

  it('should handle objects by JSON stringifying', () => {
    const key = createCacheKey('prefix', { foo: 'bar' });
    expect(key).toBe('prefix:{"foo":"bar"}');
  });

  it('should handle null and undefined', () => {
    expect(createCacheKey('prefix', null, undefined)).toBe('prefix::');
  });

  it('should handle mixed types', () => {
    const key = createCacheKey('search', 'query', { limit: 10 });
    expect(key).toBe('search:query:{"limit":10}');
  });
});

describe('hashString', () => {
  it('should produce consistent hashes', () => {
    const hash1 = hashString('test');
    const hash2 = hashString('test');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different strings', () => {
    const hash1 = hashString('test1');
    const hash2 = hashString('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty strings', () => {
    const hash = hashString('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
