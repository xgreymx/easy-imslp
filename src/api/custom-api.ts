import { HttpClient } from '../client/http.js';
import type {
  IMSLPListPeopleResponse,
  IMSLPListWorksResponse,
  IMSLPPersonType,
} from './types.js';

/**
 * Base URL for IMSLP's Custom API
 */
const CUSTOM_API_URL = 'https://imslp.org/imslpscripts/API.ISCR.php';

/**
 * Person type constants for the Custom API
 */
export const PERSON_TYPE = {
  COMPOSER: '1' as IMSLPPersonType,
  PERFORMER: '2' as IMSLPPersonType,
  EDITOR: '3' as IMSLPPersonType,
  LIBRETTIST: '4' as IMSLPPersonType,
} as const;

/**
 * Options for listing people
 */
export interface ListPeopleOptions {
  /** Type of person to list (default: Composer) */
  type?: IMSLPPersonType;
  /** Starting index (for pagination) */
  start?: number;
  /** Number of results to return (default: 20, max varies) */
  limit?: number;
  /** Sort order */
  sort?: 'name' | 'id';
}

/**
 * Options for listing works
 */
export interface ListWorksOptions {
  /** Starting index (for pagination) */
  start?: number;
  /** Number of results to return */
  limit?: number;
  /** Filter by composer ID */
  composerId?: string;
}

/**
 * Parsed person from Custom API
 */
export interface ParsedPerson {
  /** IMSLP ID */
  id: string;
  /** Page title/slug */
  slug: string;
  /** Person type */
  type: IMSLPPersonType;
  /** Raw internal values */
  intvals?: Record<string, unknown>;
}

/**
 * Parsed work from Custom API
 */
export interface ParsedWork {
  /** IMSLP ID */
  id: string;
  /** Page title/slug */
  slug: string;
  /** Composer slug */
  composerSlug?: string;
  /** Work title */
  title?: string;
  /** Catalogue number */
  catalogueNumber?: string;
  /** Page ID */
  pageId?: string;
  /** Permanent link */
  permlink?: string;
  /** Parent work ID (for movements, arrangements) */
  parentId?: string;
  /** Raw internal values */
  intvals?: Record<string, unknown>;
}

/**
 * Wrapper for IMSLP's Custom API (API.ISCR.php)
 *
 * This API provides structured access to IMSLP's database of composers and works.
 * It's faster than scraping but returns less detailed information than page parsing.
 */
export class CustomApi {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List people (composers, performers, etc.)
   */
  async listPeople(
    options: ListPeopleOptions = {}
  ): Promise<{ people: ParsedPerson[]; total: number; hasMore: boolean }> {
    const { type = PERSON_TYPE.COMPOSER, start = 0, limit = 20 } = options;

    const response = await this.http.get<IMSLPListPeopleResponse>(CUSTOM_API_URL, {
      params: {
        account: 'worklist/disclaimer=accepted/sort=id/type=' + type + '/start=' + start + '/limit=' + limit,
        type: 'people',
        retformat: 'json',
      },
    });

    const data = response.data;
    const total = data.metadata?.totalpeople ?? 0;
    const peopleRecord = data.people ?? {};

    const people: ParsedPerson[] = Object.entries(peopleRecord).map(([slug, entry]) => ({
      id: entry.id,
      slug: decodeURIComponent(slug.replace(/_/g, ' ')),
      type: entry.type,
      intvals: entry.intvals,
    }));

    // Check if there are more results
    const hasMore = start + people.length < total;

    return { people, total, hasMore };
  }

  /**
   * List all composers
   */
  async listComposers(options: Omit<ListPeopleOptions, 'type'> = {}) {
    return this.listPeople({ ...options, type: PERSON_TYPE.COMPOSER });
  }

  /**
   * List all performers
   */
  async listPerformers(options: Omit<ListPeopleOptions, 'type'> = {}) {
    return this.listPeople({ ...options, type: PERSON_TYPE.PERFORMER });
  }

  /**
   * Async generator for iterating through all people
   */
  async *browseAllPeople(
    options: Omit<ListPeopleOptions, 'start'> = {}
  ): AsyncGenerator<ParsedPerson> {
    let start = 0;
    const limit = options.limit ?? 50;

    while (true) {
      const result = await this.listPeople({ ...options, start, limit });

      for (const person of result.people) {
        yield person;
      }

      if (!result.hasMore || result.people.length === 0) {
        break;
      }

      start += result.people.length;
    }
  }

  /**
   * Async generator for all composers
   */
  async *browseAllComposers(
    options: Omit<ListPeopleOptions, 'type' | 'start'> = {}
  ): AsyncGenerator<ParsedPerson> {
    yield* this.browseAllPeople({ ...options, type: PERSON_TYPE.COMPOSER });
  }

  /**
   * List works
   */
  async listWorks(
    options: ListWorksOptions = {}
  ): Promise<{ works: ParsedWork[]; total: number; hasMore: boolean }> {
    const { start = 0, limit = 20, composerId } = options;

    let account = 'worklist/disclaimer=accepted/sort=id/start=' + start + '/limit=' + limit;
    if (composerId) {
      account += '/composer=' + composerId;
    }

    const response = await this.http.get<IMSLPListWorksResponse>(CUSTOM_API_URL, {
      params: {
        account,
        type: 'works',
        retformat: 'json',
      },
    });

    const data = response.data;
    const total = data.metadata?.totalworks ?? 0;
    const worksRecord = data.works ?? {};

    const works: ParsedWork[] = Object.entries(worksRecord).map(([slug, entry]) => {
      const intvals = entry.intvals ?? {};
      return {
        id: entry.id,
        slug: decodeURIComponent(slug.replace(/_/g, ' ')),
        composerSlug: intvals.composer ? String(intvals.composer) : undefined,
        title: intvals.worktitle ? String(intvals.worktitle) : undefined,
        catalogueNumber: intvals.icatno ? String(intvals.icatno) : undefined,
        pageId: intvals.pageid ? String(intvals.pageid) : undefined,
        permlink: entry.permlink,
        parentId: entry.parent,
        intvals,
      };
    });

    const hasMore = start + works.length < total;

    return { works, total, hasMore };
  }

  /**
   * Async generator for iterating through all works
   */
  async *browseAllWorks(options: Omit<ListWorksOptions, 'start'> = {}): AsyncGenerator<ParsedWork> {
    let start = 0;
    const limit = options.limit ?? 50;

    while (true) {
      const result = await this.listWorks({ ...options, start, limit });

      for (const work of result.works) {
        yield work;
      }

      if (!result.hasMore || result.works.length === 0) {
        break;
      }

      start += result.works.length;
    }
  }

  /**
   * Get API metadata (version, rate limits, totals)
   */
  async getMetadata(): Promise<{
    timestamp: string;
    version: string;
    rateLimit: string;
    totalComposers: number;
    totalWorks: number;
  }> {
    // Make a minimal request to get metadata
    const response = await this.http.get<IMSLPListPeopleResponse>(CUSTOM_API_URL, {
      params: {
        account: 'worklist/disclaimer=accepted/sort=id/type=1/start=0/limit=1',
        type: 'people',
        retformat: 'json',
      },
    });

    const metadata = response.data.metadata;

    return {
      timestamp: metadata.timestamp,
      version: metadata.apiversion,
      rateLimit: metadata.apirate,
      totalComposers: metadata.totalpeople ?? 0,
      totalWorks: metadata.totalworks ?? 0,
    };
  }
}
