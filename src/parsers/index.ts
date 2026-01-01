// Wikitext parsing
export {
  extractTemplates,
  parseTemplate,
  findTemplate,
  findAllTemplates,
  extractWikiLinks,
  stripWikiMarkup,
  parseYear,
  parseYearRange,
} from './wikitext.js';
export type { ParsedTemplate } from './wikitext.js';

// Catalogue parsing
export {
  parseCatalogue,
  parseAllCatalogues,
  parseOpus,
  formatCatalogue,
  getCatalogueSystemName,
  compareCatalogues,
} from './catalogue.js';

// Instrument parsing
export {
  normalizeInstrument,
  parseInstrument,
  parseInstruments,
  isKnownInstrument,
  getInstrumentFamily,
  sortInstruments,
} from './instrument.js';

// Response parsing
export {
  parseComposerWikitext,
  parseWorkWikitext,
  parseScoreWikitext,
  createComposerReference,
} from './response.js';
