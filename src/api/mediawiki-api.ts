import { HttpClient } from '../client/http.js';
import type {
  OpenSearchResponse,
  MWSearchResponse,
  MWParseResponse,
  MWCategoryMembersResponse,
  MWImageInfoResponse,
  MWSearchResult,
} from './types.js';

/**
 * Base URL for IMSLP's MediaWiki API
 */
const MEDIAWIKI_API_URL = 'https://imslp.org/api.php';

/**
 * MediaWiki API namespace constants
 */
export const MW_NAMESPACE = {
  MAIN: 0,
  CATEGORY: 14,
  FILE: 6,
  TEMPLATE: 10,
} as const;

/**
 * Options for MediaWiki search
 */
export interface MWSearchOptions {
  /** Maximum number of results (default: 10, max: 500) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Namespace to search in (default: 0 for main) */
  namespace?: number;
  /** What to search: title, text, or nearmatch */
  what?: 'title' | 'text' | 'nearmatch';
}

/**
 * Options for parsing a page
 */
export interface MWParseOptions {
  /** Get wikitext instead of HTML */
  wikitext?: boolean;
  /** Specific section to parse (0 = intro) */
  section?: number;
  /** Additional properties to fetch */
  props?: Array<'text' | 'wikitext' | 'categories' | 'links' | 'templates' | 'images' | 'sections'>;
}

/**
 * Options for category members
 */
export interface MWCategoryOptions {
  /** Maximum number of results (default: 50, max: 500) */
  limit?: number;
  /** Continue token for pagination */
  continueToken?: string;
  /** Filter by namespace */
  namespace?: number;
  /** Sort order */
  sort?: 'sortkey' | 'timestamp';
}

/**
 * Wrapper for IMSLP's MediaWiki API
 */
export class MediaWikiApi {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * OpenSearch - autocomplete search
   * Returns suggested page titles matching the query
   */
  async openSearch(query: string, limit: number = 10): Promise<string[]> {
    const response = await this.http.get<OpenSearchResponse>(MEDIAWIKI_API_URL, {
      params: {
        action: 'opensearch',
        search: query,
        limit,
        namespace: MW_NAMESPACE.MAIN,
        format: 'json',
      },
    });

    // OpenSearch returns [query, [suggestions], [descriptions], [urls]]
    return response.data[1] ?? [];
  }

  /**
   * Full-text search
   */
  async search(
    query: string,
    options: MWSearchOptions = {}
  ): Promise<{ results: MWSearchResult[]; total: number; hasMore: boolean }> {
    const { limit = 10, offset = 0, namespace = MW_NAMESPACE.MAIN, what = 'text' } = options;

    const response = await this.http.get<MWSearchResponse>(MEDIAWIKI_API_URL, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        sroffset: offset,
        srnamespace: namespace,
        srwhat: what,
        srprop: 'size|wordcount|timestamp|snippet',
        format: 'json',
      },
    });

    const data = response.data;
    const results = data.query?.search ?? [];
    const total = data.query?.searchinfo?.totalhits ?? results.length;
    // Check both 'continue' and 'query-continue' for backwards compatibility
    const hasMore = data.continue !== undefined || data['query-continue'] !== undefined;

    return { results, total, hasMore };
  }

  /**
   * Search specifically for works (compositions)
   * Works in IMSLP have titles that don't start with "Category:"
   */
  async searchWorks(query: string, options: Omit<MWSearchOptions, 'namespace'> = {}) {
    return this.search(query, { ...options, namespace: MW_NAMESPACE.MAIN });
  }

  /**
   * Search specifically for categories (composers, etc.)
   */
  async searchCategories(query: string, options: Omit<MWSearchOptions, 'namespace'> = {}) {
    return this.search(query, { ...options, namespace: MW_NAMESPACE.CATEGORY });
  }

  /**
   * Parse a page to get its content
   */
  async parsePage(title: string, options: MWParseOptions = {}): Promise<MWParseResponse['parse']> {
    const { wikitext = false, section, props = ['text', 'categories', 'templates'] } = options;

    const propList = wikitext ? ['wikitext', ...props.filter((p) => p !== 'text')] : props;

    const params: Record<string, string | number | boolean | undefined> = {
      action: 'parse',
      page: title,
      prop: propList.join('|'),
      format: 'json',
      disablelimitreport: true,
      disableeditsection: true,
    };

    if (section !== undefined) {
      params.section = section;
    }

    const response = await this.http.get<MWParseResponse>(MEDIAWIKI_API_URL, { params });

    return response.data.parse;
  }

  /**
   * Parse wikitext directly (without fetching a page)
   */
  async parseWikitext(wikitext: string, title?: string): Promise<MWParseResponse['parse']> {
    const response = await this.http.post<MWParseResponse>(
      MEDIAWIKI_API_URL,
      `action=parse&text=${encodeURIComponent(wikitext)}&contentmodel=wikitext&format=json${title ? `&title=${encodeURIComponent(title)}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.parse;
  }

  /**
   * Get raw wikitext content of a page
   */
  async getPageWikitext(title: string): Promise<string> {
    const result = await this.parsePage(title, { wikitext: true, props: ['wikitext'] });
    return result.wikitext?.['*'] ?? '';
  }

  /**
   * Get members of a category
   */
  async getCategoryMembers(
    category: string,
    options: MWCategoryOptions = {}
  ): Promise<{ members: Array<{ pageid: number; title: string }>; continueToken?: string }> {
    const { limit = 50, continueToken, namespace, sort = 'sortkey' } = options;

    // Ensure category has proper prefix
    const categoryTitle = category.startsWith('Category:') ? category : `Category:${category}`;

    const params: Record<string, string | number | boolean | undefined> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: limit,
      cmsort: sort,
      cmprop: 'ids|title',
      format: 'json',
    };

    if (continueToken) {
      params.cmcontinue = continueToken;
    }
    if (namespace !== undefined) {
      params.cmnamespace = namespace;
    }

    const response = await this.http.get<MWCategoryMembersResponse>(MEDIAWIKI_API_URL, { params });

    const members = response.data.query.categorymembers.map((m) => ({
      pageid: m.pageid,
      title: m.title,
    }));

    return {
      members,
      continueToken: response.data.continue?.cmcontinue,
    };
  }

  /**
   * Async generator for iterating through all category members
   */
  async *browseCategoryMembers(
    category: string,
    options: Omit<MWCategoryOptions, 'continueToken'> = {}
  ): AsyncGenerator<{ pageid: number; title: string }> {
    let continueToken: string | undefined;

    do {
      const result = await this.getCategoryMembers(category, { ...options, continueToken });

      for (const member of result.members) {
        yield member;
      }

      continueToken = result.continueToken;
    } while (continueToken);
  }

  /**
   * Get image/file info
   */
  async getImageInfo(
    filename: string
  ): Promise<MWImageInfoResponse['query']['pages'][string] | null> {
    // Ensure filename has proper prefix
    const fileTitle = filename.startsWith('File:') ? filename : `File:${filename}`;

    const response = await this.http.get<MWImageInfoResponse>(MEDIAWIKI_API_URL, {
      params: {
        action: 'query',
        titles: fileTitle,
        prop: 'imageinfo',
        iiprop: 'timestamp|user|size|url|mime|mediatype',
        format: 'json',
      },
    });

    const pages = response.data.query.pages;
    const page = Object.values(pages)[0];

    if (page?.missing) {
      return null;
    }

    return page ?? null;
  }

  /**
   * Get info about multiple pages
   */
  async getPageInfo(titles: string[]): Promise<Map<string, { pageid: number; exists: boolean }>> {
    const response = await this.http.get<{
      query: { pages: Record<string, { pageid?: number; ns: number; title: string; missing?: boolean }> };
    }>(MEDIAWIKI_API_URL, {
      params: {
        action: 'query',
        titles: titles.join('|'),
        format: 'json',
      },
    });

    const result = new Map<string, { pageid: number; exists: boolean }>();

    for (const page of Object.values(response.data.query.pages)) {
      result.set(page.title, {
        pageid: page.pageid ?? -1,
        exists: !page.missing,
      });
    }

    return result;
  }
}
