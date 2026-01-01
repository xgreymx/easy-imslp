/**
 * Work service for IMSLP
 *
 * Provides operations for fetching, browsing, and enriching work data.
 */

import { MediaWikiApi } from '../api/mediawiki-api.js';
import type { ParseResult } from '../client/types.js';
import type {
  Work,
  WorkWithMethods,
  EnrichedWork,
  ValidationResult,
  ValidationIssue,
} from '../models/work.js';
import { parseWorkWikitext } from '../parsers/response.js';
import { NotFoundError } from '../errors/errors.js';

/**
 * Work service
 */
export class WorkService {
  private readonly api: MediaWikiApi;

  constructor(api: MediaWikiApi) {
    this.api = api;
  }

  /**
   * Get a work by its IMSLP slug
   *
   * @param slug - Work slug like "Piano_Sonata_No.14_(Beethoven,_Ludwig_van)"
   */
  async getWork(slug: string): Promise<ParseResult<WorkWithMethods>> {
    const normalizedSlug = this.normalizeSlug(slug);

    try {
      const wikitext = await this.api.getPageWikitext(normalizedSlug);

      if (!wikitext) {
        throw new NotFoundError(`Work not found: ${slug}`, {
          url: `https://imslp.org/wiki/${normalizedSlug}`,
          suggestion: 'Check the slug format. Use findWork() for fuzzy matching.',
        });
      }

      const parsed = parseWorkWikitext(wikitext, normalizedSlug);
      return {
        data: this.addMethods(parsed.data),
        warnings: parsed.warnings,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new NotFoundError(`Work not found: ${slug}`, {
        url: `https://imslp.org/wiki/${normalizedSlug}`,
        suggestion: 'Check the slug format. Use findWork() for fuzzy matching.',
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Find a work using fuzzy matching
   *
   * @param query - Human-friendly query like "Moonlight Sonata Beethoven"
   */
  async findWork(query: string): Promise<ParseResult<WorkWithMethods | null>> {
    // Try autocomplete to find matching works
    const suggestions = await this.api.openSearch(query, 5);

    // Filter out categories (we want works, not composers)
    const workSuggestions = suggestions.filter((s) => !s.startsWith('Category:'));

    if (workSuggestions.length === 0) {
      return { data: null, warnings: [`No work found for query: ${query}`] };
    }

    // Get the first (best) match
    const title = workSuggestions[0]!;

    try {
      const wikitext = await this.api.getPageWikitext(title);
      const parsed = parseWorkWikitext(wikitext, title);
      return {
        data: this.addMethods(parsed.data),
        warnings: parsed.warnings,
      };
    } catch {
      return { data: null, warnings: [`Failed to parse work: ${title}`] };
    }
  }

  /**
   * Browse all works by a composer using async iteration
   *
   * @param composerSlug - Composer slug like "Beethoven,_Ludwig_van"
   */
  async *browseComposerWorks(composerSlug: string): AsyncGenerator<ParseResult<WorkWithMethods>> {
    const normalizedSlug = this.normalizeSlug(composerSlug);
    const categoryTitle = `Category:${normalizedSlug}`;

    for await (const member of this.api.browseCategoryMembers(categoryTitle)) {
      // Skip subcategories
      if (member.title.startsWith('Category:')) continue;

      try {
        const wikitext = await this.api.getPageWikitext(member.title);
        const parsed = parseWorkWikitext(wikitext, member.title, composerSlug);
        yield {
          data: this.addMethods(parsed.data),
          warnings: parsed.warnings,
        };
      } catch {
        yield {
          data: this.addMethods(this.createMinimalWork(member.title, composerSlug)),
          warnings: [`Failed to fully parse work: ${member.title}`],
        };
      }
    }
  }

  /**
   * Get works by a composer (paginated)
   *
   * @param composerSlug - Composer slug
   * @param limit - Maximum number of works to return
   */
  async getComposerWorks(
    composerSlug: string,
    limit: number = 50
  ): Promise<ParseResult<WorkWithMethods[]>> {
    const allWarnings: string[] = [];
    const works: WorkWithMethods[] = [];

    const normalizedSlug = this.normalizeSlug(composerSlug);
    const categoryTitle = `Category:${normalizedSlug}`;

    const result = await this.api.getCategoryMembers(categoryTitle, { limit });

    for (const member of result.members) {
      // Skip subcategories
      if (member.title.startsWith('Category:')) continue;

      try {
        const wikitext = await this.api.getPageWikitext(member.title);
        const parsed = parseWorkWikitext(wikitext, member.title, composerSlug);
        works.push(this.addMethods(parsed.data));
        allWarnings.push(...parsed.warnings);
      } catch {
        allWarnings.push(`Failed to parse work: ${member.title}`);
      }
    }

    return { data: works, warnings: allWarnings };
  }

  /**
   * Validate a work's data
   */
  validateWork(work: Work): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Required fields
    if (!work.title) {
      issues.push({
        field: 'title',
        message: 'Work title is missing',
        severity: 'error',
      });
    }

    if (!work.composer.slug && !work.composer.name) {
      issues.push({
        field: 'composer',
        message: 'Composer information is missing',
        severity: 'error',
      });
    }

    // Recommended fields
    if (work.instrumentation.length === 0) {
      issues.push({
        field: 'instrumentation',
        message: 'No instrumentation data available',
        severity: 'warning',
      });
    }

    if (!work.year) {
      issues.push({
        field: 'year',
        message: 'Composition year is missing',
        severity: 'warning',
      });
    }

    if (!work.key) {
      issues.push({
        field: 'key',
        message: 'Musical key is missing',
        severity: 'warning',
      });
    }

    // Data quality checks
    if (work.year && (work.year < 800 || work.year > new Date().getFullYear())) {
      issues.push({
        field: 'year',
        message: `Composition year ${work.year} seems invalid`,
        severity: 'warning',
      });
    }

    if (work.difficulty && (work.difficulty.level < 1 || work.difficulty.level > 9)) {
      issues.push({
        field: 'difficulty',
        message: `Difficulty level ${work.difficulty.level} is out of range (1-9)`,
        severity: 'warning',
      });
    }

    return {
      valid: !issues.some((i) => i.severity === 'error'),
      issues,
    };
  }

  /**
   * Enrich a work with scraped data (download counts, ratings)
   *
   * Note: This performs additional HTTP requests to fetch the data.
   */
  async enrichWork(work: Work): Promise<EnrichedWork> {
    // For now, return the work as-is since scraping isn't implemented yet
    // In a full implementation, this would:
    // 1. Fetch the work's HTML page
    // 2. Parse download counts from the page
    // 3. Parse user ratings
    // 4. Return enriched data

    return {
      ...work,
      downloadCount: undefined,
      userRating: undefined,
    };
  }

  /**
   * Add methods to a Work object
   */
  private addMethods(work: Work): WorkWithMethods {
    const service = this;

    return {
      ...work,
      validate() {
        return service.validateWork(this);
      },
      async enrich() {
        return service.enrichWork(this);
      },
    };
  }

  /**
   * Normalize a work slug
   */
  private normalizeSlug(slug: string): string {
    return slug.replace(/ /g, '_');
  }

  /**
   * Create a minimal work object from just a slug
   */
  private createMinimalWork(slug: string, composerSlug?: string): Work {
    const title = this.formatSlugAsTitle(slug);

    return {
      slug,
      title,
      fullTitle: title,
      url: `https://imslp.org/wiki/${encodeURIComponent(slug.replace(/ /g, '_'))}`,
      composer: {
        slug: composerSlug ?? this.extractComposerFromSlug(slug) ?? '',
        name: composerSlug ? this.formatSlugAsName(composerSlug) : '',
      },
      instrumentation: [],
    };
  }

  /**
   * Format a slug as a work title
   */
  private formatSlugAsTitle(slug: string): string {
    return slug
      .replace(/_/g, ' ')
      .replace(/\s*\([^)]+\)\s*$/, '') // Remove composer suffix
      .trim();
  }

  /**
   * Extract composer slug from a work slug
   */
  private extractComposerFromSlug(workSlug: string): string | undefined {
    const match = workSlug.match(/\(([^)]+)\)$/);
    return match?.[1]?.replace(/_/g, ' ');
  }

  /**
   * Format a slug as a display name
   */
  private formatSlugAsName(slug: string): string {
    const parts = slug.replace(/_/g, ' ').split(',').map((s) => s.trim());

    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }

    return parts.join(', ');
  }
}
