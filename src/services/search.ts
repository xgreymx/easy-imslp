/**
 * Search service for IMSLP
 *
 * Provides unified search across works and composers with result merging.
 */

import { MediaWikiApi } from '../api/mediawiki-api.js';
import type { ParseResult, SearchResult, SearchOptions } from '../client/types.js';
import type { Work } from '../models/work.js';
import type { Composer } from '../models/composer.js';
import type { Instrument, InstrumentInfo } from '../models/instrument.js';
import { parseWorkWikitext, parseComposerWikitext } from '../parsers/response.js';

/**
 * Internal search options with defaults applied
 */
interface InternalSearchOptions {
  type: 'work' | 'composer' | 'all';
  instrument?: Instrument | Instrument[];
  composer?: string;
  limit: number;
}

/**
 * Search service
 */
export class SearchService {
  private readonly api: MediaWikiApi;

  constructor(api: MediaWikiApi) {
    this.api = api;
  }

  /**
   * Search for works by query
   */
  async search(
    query: string,
    options: Omit<SearchOptions, 'query'> = {}
  ): Promise<ParseResult<SearchResult<Work>>> {
    const opts = this.normalizeOptions(options);
    const allWarnings: string[] = [];

    // Include composer in search query for better results
    let searchQuery = query;
    if (opts.composer) {
      searchQuery = `${query} ${opts.composer}`;
    }

    // Fetch more than requested to account for filtering
    // Use higher multiplier when filters are applied
    const fetchMultiplier = (opts.instrument || opts.composer) ? 5 : 2;
    const fetchLimit = opts.limit * fetchMultiplier;

    // Search works
    const searchResult = await this.api.searchWorks(searchQuery, {
      limit: fetchLimit,
    });

    const works: Work[] = [];

    // Parse each result
    for (const result of searchResult.results) {
      // Stop if we've reached the desired limit
      if (works.length >= opts.limit) break;

      try {
        const wikitext = await this.api.getPageWikitext(result.title);
        // Don't pass composer filter to parse - let it extract from the work data
        const parsed = parseWorkWikitext(wikitext, result.title);

        // Apply filters
        if (this.matchesFilters(parsed.data, opts)) {
          works.push(parsed.data);
          allWarnings.push(...parsed.warnings);
        }
      } catch {
        allWarnings.push(`Failed to parse work: ${result.title}`);
      }
    }

    // hasMore is true if:
    // 1. The API has more results, OR
    // 2. We got more filtered results than the requested limit
    const hasMore = searchResult.hasMore || works.length > opts.limit;

    // Trim to exact limit if we got more
    const items = works.slice(0, opts.limit);

    return {
      data: {
        items,
        // Total is the number of filtered items we got, not the API total
        // Since we only fetch 2x limit, we can't know the real total with filters
        total: items.length,
        hasMore,
      },
      warnings: allWarnings,
    };
  }

  /**
   * Search for composers by query
   */
  async searchComposers(query: string, limit: number = 10): Promise<ParseResult<SearchResult<Composer>>> {
    const allWarnings: string[] = [];

    // Request 2x the limit to account for filtering
    const fetchLimit = limit * 2;

    // Search in Category namespace for composers
    const searchResult = await this.api.searchCategories(query, { limit: fetchLimit });

    const composers: Composer[] = [];

    // Parse each result
    for (const result of searchResult.results) {
      // Stop if we've reached the desired limit
      if (composers.length >= limit) break;

      // Only process composer categories
      if (!result.title.startsWith('Category:')) continue;

      const slug = result.title.replace('Category:', '');

      try {
        const wikitext = await this.api.getPageWikitext(result.title);
        const parsed = parseComposerWikitext(wikitext, slug);
        composers.push(parsed.data);
        allWarnings.push(...parsed.warnings);
      } catch {
        allWarnings.push(`Failed to parse composer: ${slug}`);
      }
    }

    // hasMore is true if API has more results OR we got more than requested
    const hasMore = searchResult.hasMore || composers.length > limit;

    // Trim to exact limit
    const items = composers.slice(0, limit);

    return {
      data: {
        items,
        total: searchResult.total,
        hasMore,
      },
      warnings: allWarnings,
    };
  }

  /**
   * Autocomplete search
   * Returns suggested titles matching the query
   */
  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    return this.api.openSearch(query, limit);
  }

  /**
   * Quick search that returns both works and composers
   */
  async searchAll(
    query: string,
    limit: number = 10
  ): Promise<ParseResult<{ works: Work[]; composers: Composer[] }>> {
    const allWarnings: string[] = [];

    // Run both searches in parallel
    const [workResult, composerResult] = await Promise.all([
      this.search(query, { limit }),
      this.searchComposers(query, limit),
    ]);

    allWarnings.push(...workResult.warnings, ...composerResult.warnings);

    return {
      data: {
        works: workResult.data.items,
        composers: composerResult.data.items,
      },
      warnings: allWarnings,
    };
  }

  /**
   * Normalize search options with defaults
   */
  private normalizeOptions(options: Omit<SearchOptions, 'query'>): InternalSearchOptions {
    return {
      type: options.type ?? 'work',
      instrument: options.instrument,
      composer: options.composer,
      limit: options.limit ?? 10,
    };
  }

  /**
   * Check if a work matches the search filters
   */
  private matchesFilters(work: Work, options: InternalSearchOptions): boolean {
    // Instrument filter
    if (options.instrument) {
      const instruments = Array.isArray(options.instrument)
        ? options.instrument
        : [options.instrument];

      const workInstruments = work.instrumentation.map((i: InstrumentInfo) => i.normalized);
      const hasMatch = instruments.some((inst) => workInstruments.includes(inst));

      if (!hasMatch) return false;
    }

    // Composer filter
    if (options.composer) {
      const composerLower = options.composer.toLowerCase();
      const matchesSlug = work.composer.slug.toLowerCase().includes(composerLower);
      const matchesName = work.composer.name.toLowerCase().includes(composerLower);

      if (!matchesSlug && !matchesName) return false;
    }

    return true;
  }
}
