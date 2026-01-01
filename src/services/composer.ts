/**
 * Composer service for IMSLP
 *
 * Provides operations for fetching and browsing composer data.
 */

import { MediaWikiApi } from '../api/mediawiki-api.js';
import { CustomApi } from '../api/custom-api.js';
import type { ParseResult } from '../client/types.js';
import type { Composer } from '../models/composer.js';
import { parseComposerWikitext } from '../parsers/response.js';
import { NotFoundError } from '../errors/errors.js';

/**
 * Composer service
 */
export class ComposerService {
  private readonly mediaWiki: MediaWikiApi;
  private readonly customApi: CustomApi;

  constructor(mediaWiki: MediaWikiApi, customApi: CustomApi) {
    this.mediaWiki = mediaWiki;
    this.customApi = customApi;
  }

  /**
   * Get a composer by their IMSLP slug
   *
   * @param slug - Composer slug like "Beethoven,_Ludwig_van" or "Beethoven, Ludwig van"
   */
  async getComposer(slug: string): Promise<ParseResult<Composer>> {
    // Normalize slug
    const normalizedSlug = this.normalizeSlug(slug);
    const categoryTitle = `Category:${normalizedSlug}`;

    try {
      const wikitext = await this.mediaWiki.getPageWikitext(categoryTitle);

      if (!wikitext) {
        throw new NotFoundError(`Composer not found: ${slug}`, {
          url: `https://imslp.org/wiki/${categoryTitle}`,
          suggestion: 'Check the slug format. Composer slugs use "LastName, FirstName" format.',
        });
      }

      return parseComposerWikitext(wikitext, normalizedSlug);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new NotFoundError(`Composer not found: ${slug}`, {
        url: `https://imslp.org/wiki/${categoryTitle}`,
        suggestion: 'Check the slug format. Composer slugs use "LastName, FirstName" format.',
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Find a composer using fuzzy matching
   *
   * @param query - Human-friendly query like "Beethoven" or "ludwig beethoven"
   */
  async findComposer(query: string): Promise<ParseResult<Composer | null>> {
    // Try autocomplete to find matching composers
    const suggestions = await this.mediaWiki.openSearch(`Category:${query}`, 5);

    // Filter for composer categories
    const composerSuggestions = suggestions.filter((s) => s.startsWith('Category:'));

    if (composerSuggestions.length === 0) {
      return { data: null, warnings: [`No composer found for query: ${query}`] };
    }

    // Get the first (best) match
    const categoryTitle = composerSuggestions[0]!;
    const slug = categoryTitle.replace('Category:', '');

    try {
      const wikitext = await this.mediaWiki.getPageWikitext(categoryTitle);
      return parseComposerWikitext(wikitext, slug);
    } catch {
      return { data: null, warnings: [`Failed to parse composer: ${slug}`] };
    }
  }

  /**
   * Browse all composers using async iteration
   */
  async *browseAllComposers(): AsyncGenerator<ParseResult<Composer>> {
    // Use the Custom API for efficient browsing
    for await (const person of this.customApi.browseAllComposers()) {
      try {
        const categoryTitle = `Category:${person.slug.replace(/ /g, '_')}`;
        const wikitext = await this.mediaWiki.getPageWikitext(categoryTitle);
        yield parseComposerWikitext(wikitext, person.slug);
      } catch {
        yield {
          data: this.createMinimalComposer(person.slug),
          warnings: [`Failed to fully parse composer: ${person.slug}`],
        };
      }
    }
  }

  /**
   * Get composers by letter (for browsing alphabetically)
   *
   * @param letter - Single letter A-Z
   */
  async getComposersByLetter(
    letter: string,
    limit: number = 50
  ): Promise<ParseResult<Composer[]>> {
    const allWarnings: string[] = [];
    const composers: Composer[] = [];

    // Search for categories starting with the letter
    const searchResult = await this.mediaWiki.searchCategories(letter, { limit });

    for (const result of searchResult.results) {
      if (!result.title.startsWith('Category:')) continue;

      const slug = result.title.replace('Category:', '');

      // Check if slug starts with the letter
      if (!slug.toLowerCase().startsWith(letter.toLowerCase())) continue;

      try {
        const wikitext = await this.mediaWiki.getPageWikitext(result.title);
        const parsed = parseComposerWikitext(wikitext, slug);
        composers.push(parsed.data);
        allWarnings.push(...parsed.warnings);
      } catch {
        allWarnings.push(`Failed to parse composer: ${slug}`);
      }
    }

    return { data: composers, warnings: allWarnings };
  }

  /**
   * Get works count for a composer
   */
  async getWorksCount(composerSlug: string): Promise<number> {
    const normalizedSlug = this.normalizeSlug(composerSlug);
    const categoryTitle = `Category:${normalizedSlug}`;

    try {
      const result = await this.mediaWiki.getCategoryMembers(categoryTitle, { limit: 1 });
      // The API doesn't directly give total, but we can estimate
      // by checking if there's a continue token
      return result.members.length > 0 ? -1 : 0; // -1 means "at least 1"
    } catch {
      return 0;
    }
  }

  /**
   * Normalize a composer slug
   */
  private normalizeSlug(slug: string): string {
    return slug.replace(/ /g, '_');
  }

  /**
   * Create a minimal composer object from just a slug
   */
  private createMinimalComposer(slug: string): Composer {
    const name = this.formatSlugAsName(slug);
    return {
      slug,
      name,
      fullName: name,
      sortName: slug.replace(/_/g, ' '),
      url: `https://imslp.org/wiki/Category:${encodeURIComponent(slug.replace(/ /g, '_'))}`,
    };
  }

  /**
   * Format a slug as a display name
   */
  private formatSlugAsName(slug: string): string {
    // "Beethoven,_Ludwig_van" -> "Ludwig van Beethoven"
    const parts = slug.replace(/_/g, ' ').split(',').map((s) => s.trim());

    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }

    return parts.join(', ');
  }
}
