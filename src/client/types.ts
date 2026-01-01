import type {
  Composer,
  Work,
  Score,
  Instrument,
  TimePeriod,
} from '../models/index.js';

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** Enable response caching (default: true) */
  cache?: boolean;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** User agent string for requests */
  userAgent?: string;
  /** Rate limit delay between requests in ms (default: 100) */
  rateLimitDelay?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<ClientConfig> = {
  cache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  timeout: 10000,
  userAgent: 'easy-imslp/0.1.0',
  rateLimitDelay: 100,
};

/**
 * Result wrapper with warnings for partial parsing
 */
export interface ParseResult<T> {
  /** The parsed data */
  data: T;
  /** Warnings encountered during parsing (empty if no issues) */
  warnings: string[];
}

/**
 * Search result with pagination info
 */
export interface SearchResult<T> {
  /** Result items */
  items: T[];
  /** Total number of results (if known) */
  total: number;
  /** Whether more results are available */
  hasMore: boolean;
}

/**
 * Search options for filtering results
 */
export interface SearchOptions {
  /** Search query */
  query: string;
  /** Type of results to return */
  type?: 'work' | 'composer' | 'all';
  /** Filter by instrument(s) */
  instrument?: Instrument | Instrument[];
  /** Filter by composer name or slug */
  composer?: string;
  /** Filter by time period */
  timePeriod?: TimePeriod;
  /** Maximum number of results */
  limit?: number;
}

/**
 * IMSLP Client interface
 */
export interface IMSLPClient {
  // Search
  search(
    query: string,
    options?: Omit<SearchOptions, 'query'>
  ): Promise<ParseResult<SearchResult<Work>>>;
  searchComposers(query: string): Promise<ParseResult<SearchResult<Composer>>>;
  autocomplete(query: string, limit?: number): Promise<string[]>;

  // Composers
  getComposer(slug: string): Promise<ParseResult<Composer>>;

  // Works - exact slug lookup
  getWork(slug: string): Promise<ParseResult<Work>>;

  // Works - fuzzy lookup (normalizes human-friendly input)
  findWork(query: string): Promise<ParseResult<Work | null>>;

  // Async iterators for pagination
  browseComposerWorks(composerSlug: string): AsyncIterable<ParseResult<Work>>;
  browseAllComposers(): AsyncIterable<ParseResult<Composer>>;

  // Scores
  getWorkScores(workSlug: string): Promise<ParseResult<Score[]>>;
  getScoreDownloadUrl(filename: string): Promise<string>;

  // Utilities
  clearCache(): void;
}
