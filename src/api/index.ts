export { MediaWikiApi, MW_NAMESPACE } from './mediawiki-api.js';
export type { MWSearchOptions, MWParseOptions, MWCategoryOptions } from './mediawiki-api.js';

export { CustomApi, PERSON_TYPE } from './custom-api.js';
export type {
  ListPeopleOptions,
  ListWorksOptions,
  ParsedPerson,
  ParsedWork,
} from './custom-api.js';

export { LegacyApi } from './legacy-api.js';
export type { FileInfo, GenreTag } from './legacy-api.js';

export type {
  // MediaWiki API types
  OpenSearchResponse,
  MWSearchResult,
  MWSearchResponse,
  MWParseResult,
  MWParseResponse,
  MWCategoryMembersResponse,
  MWImageInfoResponse,
  MWPageInfo,
  // Custom API types
  IMSLPPersonType,
  IMSLPApiMetadata,
  IMSLPPersonEntry,
  IMSLPWorkEntry,
  IMSLPListPeopleResponse,
  IMSLPListWorksResponse,
  // Legacy API types
  IMSLPFileInfo,
  IMSLPGenreTag,
  IMSLPLegacyLookupResponse,
  IMSLPGenreTagsResponse,
} from './types.js';
