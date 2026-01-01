import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, getDefaultClient } from '../../src/client/client.js';
import type { IMSLPClient } from '../../src/client/types.js';

// We'll mock the HTTP client to avoid actual network calls
vi.mock('../../src/client/http.js', () => {
  return {
    HttpClient: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} }),
      post: vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} }),
      clearCache: vi.fn(),
    })),
  };
});

describe('createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a client with default configuration', () => {
    const client = createClient();

    expect(client).toBeDefined();
    expect(typeof client.search).toBe('function');
    expect(typeof client.getComposer).toBe('function');
    expect(typeof client.getWork).toBe('function');
    expect(typeof client.clearCache).toBe('function');
  });

  it('should create a client with custom configuration', () => {
    const client = createClient({
      cache: false,
      cacheTTL: 10000,
      timeout: 5000,
      userAgent: 'test-agent',
      rateLimitDelay: 50,
    });

    expect(client).toBeDefined();
  });

  it('should implement IMSLPClient interface', () => {
    const client = createClient();

    // Search methods
    expect(client.search).toBeDefined();
    expect(client.searchComposers).toBeDefined();
    expect(client.autocomplete).toBeDefined();

    // Composer methods
    expect(client.getComposer).toBeDefined();

    // Work methods
    expect(client.getWork).toBeDefined();
    expect(client.findWork).toBeDefined();

    // Iterator methods
    expect(client.browseComposerWorks).toBeDefined();
    expect(client.browseAllComposers).toBeDefined();

    // Score methods
    expect(client.getWorkScores).toBeDefined();
    expect(client.getScoreDownloadUrl).toBeDefined();

    // Utility methods
    expect(client.clearCache).toBeDefined();
  });

  it('should have clearCache method', () => {
    const client = createClient();

    // Should not throw
    expect(() => client.clearCache()).not.toThrow();
  });
});

describe('getDefaultClient', () => {
  it('should return the same client instance on multiple calls', () => {
    // Note: Due to module caching, we can test this behavior
    const client1 = getDefaultClient();
    const client2 = getDefaultClient();

    expect(client1).toBe(client2);
  });

  it('should return a valid client', () => {
    const client = getDefaultClient();

    expect(typeof client.search).toBe('function');
    expect(typeof client.getComposer).toBe('function');
  });
});

describe('IMSLPClient methods', () => {
  let client: IMSLPClient;

  beforeEach(() => {
    client = createClient();
  });

  describe('autocomplete', () => {
    it('should return an array', async () => {
      // With mocked HTTP, this will return empty results
      const result = await client.autocomplete('test');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getScoreDownloadUrl', () => {
    it('should return a string URL', async () => {
      const url = await client.getScoreDownloadUrl('test.pdf');
      expect(typeof url).toBe('string');
      expect(url).toContain('test.pdf');
    });
  });

  describe('browseComposerWorks', () => {
    it('should return an async iterable', () => {
      const iterable = client.browseComposerWorks('Beethoven');
      expect(iterable[Symbol.asyncIterator]).toBeDefined();
    });
  });

  describe('browseAllComposers', () => {
    it('should return an async iterable', () => {
      const iterable = client.browseAllComposers();
      expect(iterable[Symbol.asyncIterator]).toBeDefined();
    });
  });
});
