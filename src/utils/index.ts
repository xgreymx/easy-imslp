/**
 * Utility functions for easy-imslp
 *
 * These utilities are exported separately for tree-shaking.
 *
 * @example
 * ```typescript
 * import { formatComposerName, normalizeInstrument, parseCatalogue } from 'easy-imslp/utils';
 * ```
 */

// Cache utilities
export { Cache, createCacheKey, hashString } from './cache.js';

// Formatting utilities
export {
  formatComposerName,
  formatWorkTitle,
  formatYearRange,
  formatLifespan,
  formatInstrumentation,
  groupByInstrument,
  groupByGenre,
  groupByComposer,
  slugify,
  unslugify,
  truncate,
  capitalize,
  titleCase,
  type ComposerNameStyle,
} from './format.js';

// Instrument utilities (re-exported from parsers)
export {
  normalizeInstrument,
  parseInstrument,
  parseInstruments,
  isKnownInstrument,
  getInstrumentFamily,
  sortInstruments,
} from '../parsers/instrument.js';

// Catalogue utilities (re-exported from parsers)
export {
  parseCatalogue,
  parseAllCatalogues,
  parseOpus,
  formatCatalogue,
  getCatalogueSystemName,
  compareCatalogues,
} from '../parsers/catalogue.js';

// URL utilities (re-exported from legacy API)
export {
  buildDownloadUrl,
  buildDirectDownloadUrl,
  buildPageUrl,
  buildComposerUrl,
  extractSlugFromUrl,
} from '../api/legacy-api.js';

// Wikitext utilities (re-exported from parsers)
export {
  parseYear,
  parseYearRange,
  stripWikiMarkup,
  extractWikiLinks,
} from '../parsers/wikitext.js';
