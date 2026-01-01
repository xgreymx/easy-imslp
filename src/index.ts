/**
 * easy-imslp - A modern TypeScript library for interacting with IMSLP
 *
 * @example
 * ```typescript
 * import { createClient } from 'easy-imslp';
 *
 * const client = createClient();
 *
 * // Search for pieces
 * const results = await client.search('moonlight sonata');
 * console.log(results.data.items[0].title);
 *
 * // Get a specific composer
 * const composer = await client.getComposer('Beethoven,_Ludwig_van');
 * console.log(composer.data.name);
 * ```
 *
 * @packageDocumentation
 */

// Main client factory
export { createClient, getDefaultClient } from './client/client.js';

// Client types and configuration
export { HttpClient, DEFAULT_CONFIG } from './client/index.js';
export type {
  ClientConfig,
  ParseResult,
  SearchResult,
  SearchOptions,
  IMSLPClient,
  HttpResponse,
  HttpRequestOptions,
} from './client/index.js';

// Model exports
export type {
  // Instruments
  Instrument,
  KnownInstrument,
  InstrumentInfo,
  TimePeriod,
  // Catalogue
  CatalogueSystem,
  KnownCatalogueSystem,
  CatalogueInfo,
  // Composer
  ComposerReference,
  Composer,
  // Work
  Movement,
  DifficultyRating,
  ValidationIssue,
  ValidationResult,
  Work,
  EnrichedWork,
  WorkWithMethods,
  // Score
  ScanQuality,
  Score,
  ScoreWithMethods,
} from './models/index.js';

// Error exports
export {
  IMSLPError,
  NetworkError,
  RateLimitError,
  NotFoundError,
  ParseError,
  TimeoutError,
  isIMSLPError,
  isNetworkError,
  isRateLimitError,
  isNotFoundError,
  isParseError,
  isTimeoutError,
} from './errors/index.js';
export type { IMSLPErrorDetails } from './errors/index.js';

// API wrappers
export { MediaWikiApi, MW_NAMESPACE } from './api/index.js';
export { CustomApi, PERSON_TYPE } from './api/index.js';
export { LegacyApi } from './api/index.js';
export type {
  // MediaWiki API
  MWSearchOptions,
  MWParseOptions,
  MWCategoryOptions,
  MWSearchResult,
  MWParseResult,
  // Custom API
  ListPeopleOptions,
  ListWorksOptions,
  ParsedPerson,
  ParsedWork,
  // Legacy API
  FileInfo,
  GenreTag,
} from './api/index.js';

// Parsers
export {
  // Wikitext
  extractTemplates,
  parseTemplate,
  findTemplate,
  findAllTemplates,
  extractWikiLinks,
  stripWikiMarkup,
  parseYear,
  parseYearRange,
  // Catalogue
  parseCatalogue,
  parseAllCatalogues,
  parseOpus,
  formatCatalogue,
  getCatalogueSystemName,
  compareCatalogues,
  // Instruments
  normalizeInstrument,
  parseInstrument,
  parseInstruments,
  isKnownInstrument,
  getInstrumentFamily,
  sortInstruments,
  // Response parsing
  parseComposerWikitext,
  parseWorkWikitext,
  parseScoreWikitext,
  createComposerReference,
} from './parsers/index.js';
export type { ParsedTemplate } from './parsers/index.js';

// Services (for advanced usage)
export { SearchService } from './services/search.js';
export { ComposerService } from './services/composer.js';
export { WorkService } from './services/work.js';
export { ScoreService } from './services/score.js';

// Formatting utilities (also available from 'easy-imslp/utils')
export {
  formatComposerName,
  formatWorkTitle,
  formatYearRange,
  formatLifespan,
  formatInstrumentation,
  groupByInstrument,
  groupByGenre,
  groupByComposer,
} from './utils/format.js';
export type { ComposerNameStyle } from './utils/format.js';
