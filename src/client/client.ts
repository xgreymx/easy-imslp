/**
 * IMSLP Client Factory
 *
 * Creates a configured client instance for interacting with IMSLP.
 */

import { HttpClient } from './http.js';
import type { ClientConfig, IMSLPClient, ParseResult, SearchResult, SearchOptions } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { MediaWikiApi } from '../api/mediawiki-api.js';
import { CustomApi } from '../api/custom-api.js';
import { SearchService } from '../services/search.js';
import { ComposerService } from '../services/composer.js';
import { WorkService } from '../services/work.js';
import { ScoreService } from '../services/score.js';
import type { Composer } from '../models/composer.js';
import type { Work, WorkWithMethods } from '../models/work.js';
import type { ScoreWithMethods } from '../models/score.js';

/**
 * Create a configured IMSLP client
 *
 * @example
 * ```typescript
 * import { createClient } from 'easy-imslp';
 *
 * const client = createClient({
 *   cache: true,
 *   cacheTTL: 5 * 60 * 1000, // 5 minutes
 * });
 *
 * // Search for pieces
 * const results = await client.search('moonlight sonata');
 * console.log(results.data.items[0].title);
 * ```
 */
export function createClient(config: ClientConfig = {}): IMSLPClient {
  // Merge with defaults
  const mergedConfig: Required<ClientConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Create HTTP client
  const http = new HttpClient({
    timeout: mergedConfig.timeout,
    userAgent: mergedConfig.userAgent,
    rateLimitDelay: mergedConfig.rateLimitDelay,
    cache: mergedConfig.cache,
    cacheTTL: mergedConfig.cacheTTL,
  });

  // Create API wrappers
  const mediaWikiApi = new MediaWikiApi(http);
  const customApi = new CustomApi(http);

  // Create services
  const searchService = new SearchService(mediaWikiApi);
  const composerService = new ComposerService(mediaWikiApi, customApi);
  const workService = new WorkService(mediaWikiApi);
  const scoreService = new ScoreService(mediaWikiApi);

  // Return client interface
  return {
    // Search
    async search(
      query: string,
      options?: Omit<SearchOptions, 'query'>
    ): Promise<ParseResult<SearchResult<Work>>> {
      return searchService.search(query, options);
    },

    async searchComposers(query: string): Promise<ParseResult<SearchResult<Composer>>> {
      return searchService.searchComposers(query);
    },

    async autocomplete(query: string, limit?: number): Promise<string[]> {
      return searchService.autocomplete(query, limit);
    },

    // Composers
    async getComposer(slug: string): Promise<ParseResult<Composer>> {
      return composerService.getComposer(slug);
    },

    // Works - exact slug lookup
    async getWork(slug: string): Promise<ParseResult<WorkWithMethods>> {
      return workService.getWork(slug);
    },

    // Works - fuzzy lookup
    async findWork(query: string): Promise<ParseResult<Work | null>> {
      return workService.findWork(query);
    },

    // Async iterators
    async *browseComposerWorks(composerSlug: string): AsyncIterable<ParseResult<WorkWithMethods>> {
      yield* workService.browseComposerWorks(composerSlug);
    },

    async *browseAllComposers(): AsyncIterable<ParseResult<Composer>> {
      yield* composerService.browseAllComposers();
    },

    // Scores
    async getWorkScores(workSlug: string): Promise<ParseResult<ScoreWithMethods[]>> {
      return scoreService.getWorkScores(workSlug);
    },

    async getScoreDownloadUrl(filename: string): Promise<string> {
      return scoreService.getScoreDownloadUrl(filename);
    },

    // Utilities
    clearCache(): void {
      http.clearCache();
    },
  };
}

/**
 * Default client instance
 * Use createClient() for custom configuration
 */
let defaultClient: IMSLPClient | null = null;

/**
 * Get the default client instance
 * Creates one with default config if not already created
 */
export function getDefaultClient(): IMSLPClient {
  if (!defaultClient) {
    defaultClient = createClient();
  }
  return defaultClient;
}
