/**
 * API Response Types for IMSLP APIs
 */

// =============================================================================
// MediaWiki API Types
// =============================================================================

/**
 * OpenSearch API response (autocomplete)
 * Format: [query, [suggestions], [descriptions], [urls]]
 */
export type OpenSearchResponse = [
  string, // Original query
  string[], // Suggested titles
  string[], // Descriptions (usually empty)
  string[], // URLs
];

/**
 * MediaWiki search result item
 */
export interface MWSearchResult {
  ns: number;
  title: string;
  pageid: number;
  size?: number;
  wordcount?: number;
  snippet?: string;
  timestamp?: string;
}

/**
 * MediaWiki search API response
 */
export interface MWSearchResponse {
  batchcomplete?: string;
  continue?: {
    sroffset: number;
    continue: string;
  };
  query: {
    searchinfo?: {
      totalhits: number;
    };
    search: MWSearchResult[];
  };
}

/**
 * MediaWiki page info
 */
export interface MWPageInfo {
  pageid: number;
  ns: number;
  title: string;
  contentmodel?: string;
  pagelanguage?: string;
  touched?: string;
  lastrevid?: number;
  length?: number;
  redirect?: boolean;
  missing?: boolean;
}

/**
 * MediaWiki parse result
 */
export interface MWParseResult {
  title: string;
  pageid: number;
  revid?: number;
  text?: {
    '*': string;
  };
  wikitext?: {
    '*': string;
  };
  categories?: Array<{
    sortkey: string;
    '*': string;
    hidden?: boolean;
  }>;
  links?: Array<{
    ns: number;
    exists?: boolean;
    '*': string;
  }>;
  templates?: Array<{
    ns: number;
    exists?: boolean;
    '*': string;
  }>;
  images?: string[];
  sections?: Array<{
    toclevel: number;
    level: string;
    line: string;
    number: string;
    index: string;
    fromtitle: string;
    byteoffset: number;
    anchor: string;
  }>;
}

/**
 * MediaWiki parse API response
 */
export interface MWParseResponse {
  parse: MWParseResult;
}

/**
 * MediaWiki category members response
 */
export interface MWCategoryMembersResponse {
  batchcomplete?: string;
  continue?: {
    cmcontinue: string;
    continue: string;
  };
  query: {
    categorymembers: Array<{
      pageid: number;
      ns: number;
      title: string;
    }>;
  };
}

/**
 * MediaWiki image info response
 */
export interface MWImageInfoResponse {
  batchcomplete?: string;
  query: {
    pages: Record<
      string,
      {
        pageid?: number;
        ns: number;
        title: string;
        missing?: boolean;
        imagerepository?: string;
        imageinfo?: Array<{
          timestamp: string;
          user: string;
          size: number;
          width: number;
          height: number;
          url: string;
          descriptionurl: string;
          descriptionshorturl?: string;
          mime: string;
          mediatype: string;
        }>;
      }
    >;
  };
}

// =============================================================================
// IMSLP Custom API Types
// =============================================================================

/**
 * Person type in IMSLP Custom API
 */
export type IMSLPPersonType = '1' | '2' | '3' | '4';
// 1 = Composer
// 2 = Performer
// 3 = Editor
// 4 = Librettist/Other

/**
 * IMSLP Custom API metadata response
 */
export interface IMSLPApiMetadata {
  timestamp: string;
  apiversion: string;
  apilicense: string;
  apirate: string;
  totalpeople?: number;
  totalworks?: number;
}

/**
 * Person entry from IMSLP Custom API
 */
export interface IMSLPPersonEntry {
  id: string;
  type: IMSLPPersonType;
  intvals?: Record<string, unknown>;
}

/**
 * Work entry from IMSLP Custom API
 */
export interface IMSLPWorkEntry {
  id: string;
  type: string;
  parent?: string;
  intvals?: {
    composer?: string;
    worktitle?: string;
    icatno?: string;
    pageid?: string;
    [key: string]: unknown;
  };
  permlink?: string;
}

/**
 * IMSLP Custom API list people response
 */
export interface IMSLPListPeopleResponse {
  metadata: IMSLPApiMetadata;
  people?: Record<string, IMSLPPersonEntry>;
}

/**
 * IMSLP Custom API list works response
 */
export interface IMSLPListWorksResponse {
  metadata: IMSLPApiMetadata;
  works?: Record<string, IMSLPWorkEntry>;
}

// =============================================================================
// IMSLP Legacy API Types
// =============================================================================

/**
 * File info from legacy API
 */
export interface IMSLPFileInfo {
  filename: string;
  url?: string;
  size?: number;
  mimetype?: string;
  timestamp?: string;
  description?: string;
}

/**
 * Legacy API lookup response
 */
export interface IMSLPLegacyLookupResponse {
  files?: Record<string, IMSLPFileInfo>;
  error?: string;
}

/**
 * Genre tag from legacy API
 */
export interface IMSLPGenreTag {
  id: string;
  name: string;
  description?: string;
}

/**
 * Legacy API genre tags response
 */
export interface IMSLPGenreTagsResponse {
  tags?: IMSLPGenreTag[];
  error?: string;
}
