# easy-imslp

A modern, type-safe TypeScript library for interacting with the [IMSLP](https://imslp.org) (International Music Score Library Project) API.

## Features

- **Type-safe**: Full TypeScript support with detailed type definitions
- **Lenient parsing**: Returns partial data with warnings instead of throwing on parse errors
- **Caching**: Built-in in-memory caching with configurable TTL
- **Rate limiting**: Automatic rate limiting to respect IMSLP's API limits
- **Async iterators**: Efficient pagination for browsing large datasets
- **Utility functions**: Helpers for instrument normalization, catalogue parsing, and more

## Installation

```bash
npm install easy-imslp
```

**Requires Node.js 18+** (uses native fetch)

## Quick Start

```typescript
import { createClient } from 'easy-imslp';

const client = createClient();

// Search for pieces
const results = await client.search('moonlight sonata', {
  instrument: 'piano',
  limit: 10,
});

for (const work of results.data.items) {
  console.log(work.title);         // "Piano Sonata No.14"
  console.log(work.composer.name); // "Ludwig van Beethoven"
  console.log(work.opus);          // "Op.27 No.2"
}

// Handle parsing warnings
if (results.warnings.length > 0) {
  console.warn('Some data may be incomplete:', results.warnings);
}
```

## API Reference

### Creating a Client

```typescript
import { createClient } from 'easy-imslp';

const client = createClient({
  cache: true,                    // Enable caching (default: true)
  cacheTTL: 5 * 60 * 1000,       // Cache TTL in ms (default: 5 minutes)
  timeout: 10000,                 // Request timeout in ms (default: 10000)
  userAgent: 'my-app/1.0',       // Custom user agent
  rateLimitDelay: 100,           // Delay between requests in ms (default: 100)
});
```

### Search

```typescript
// Search for works
const works = await client.search('beethoven symphony');

// Search with filters
const pianoWorks = await client.search('sonata', {
  instrument: 'piano',
  composer: 'Mozart',
  limit: 20,
});

// Search for composers
const composers = await client.searchComposers('Bach');

// Autocomplete (for search suggestions)
const suggestions = await client.autocomplete('beetho', 5);
// ["Beethoven, Ludwig van", "Beethoven's Wig", ...]
```

### Getting Specific Items

```typescript
// Get a composer by slug
const composer = await client.getComposer('Beethoven,_Ludwig_van');
console.log(composer.data.birthYear);  // 1770
console.log(composer.data.nationality); // "German"

// Get a work by exact slug
const work = await client.getWork('Piano_Sonata_No.14_(Beethoven,_Ludwig_van)');
console.log(work.data.key);            // "C-sharp minor"
console.log(work.data.year);           // 1801

// Fuzzy lookup (human-friendly input)
const result = await client.findWork('Moonlight Sonata Beethoven');
if (result.data) {
  console.log(result.data.title);
}
```

### Browsing with Async Iterators

```typescript
// Browse all works by a composer
for await (const result of client.browseComposerWorks('Bach,_Johann_Sebastian')) {
  console.log(result.data.title);

  // Can break early
  if (foundWhatWeNeed) break;
}

// Browse all composers
for await (const result of client.browseAllComposers()) {
  console.log(result.data.name);
}
```

### Scores

```typescript
// Get all scores for a work
const scores = await client.getWorkScores('Nocturnes_(Chopin,_Frederic)');

for (const score of scores.data) {
  console.log(score.filename);
  console.log(score.editor);
  console.log(score.isUrtext);
}

// Get download URL
const url = await client.getScoreDownloadUrl('PMLP01458-test.pdf');
```

### Validation

```typescript
const work = await client.getWork('...');

// Validate data quality
const validation = work.data.validate();
if (!validation.valid) {
  for (const issue of validation.issues) {
    console.warn(`${issue.field}: ${issue.message}`);
  }
}
```

## Utility Functions

Import utilities separately for tree-shaking:

```typescript
import {
  formatComposerName,
  normalizeInstrument,
  parseCatalogue,
  groupByInstrument,
} from 'easy-imslp/utils';

// Format composer names
formatComposerName('Beethoven,_Ludwig_van', 'full');   // "Ludwig van Beethoven"
formatComposerName('Beethoven,_Ludwig_van', 'short');  // "Beethoven"
formatComposerName('Beethoven,_Ludwig_van', 'sort');   // "Beethoven, Ludwig van"

// Normalize instrument names
normalizeInstrument('vln.');     // "violin"
normalizeInstrument('pf');       // "piano"
normalizeInstrument('violins');  // "violin"

// Parse catalogue numbers
parseCatalogue('BWV 1001');
// { raw: 'BWV 1001', system: 'bwv', number: 1001 }

parseCatalogue('Op. 27 No. 2');
// { raw: 'Op. 27 No. 2', system: 'op', number: 27, suffix: 'No.2' }

// Group works by instrument
const grouped = groupByInstrument(works);
// { piano: [...], violin: [...], orchestra: [...] }
```

### Available Utilities

| Function | Description |
|----------|-------------|
| `formatComposerName(slug, style)` | Format composer slug as readable name |
| `normalizeInstrument(raw)` | Normalize instrument abbreviations |
| `parseCatalogue(text)` | Parse catalogue numbers (BWV, K, Op, etc.) |
| `groupByInstrument(works)` | Group works by primary instrument |
| `groupByGenre(works)` | Group works by genre |
| `groupByComposer(works)` | Group works by composer |
| `buildDownloadUrl(filename)` | Build IMSLP download URL |
| `parseYear(text)` | Extract year from text |

## Data Types

### Work

```typescript
interface Work {
  slug: string;
  title: string;              // "Piano Sonata No.14"
  fullTitle: string;          // "Piano Sonata No.14, Op.27 No.2"
  url: string;
  composer: ComposerReference;
  opus?: string;
  catalogue?: CatalogueInfo;
  key?: string;               // "C-sharp minor"
  year?: number;
  movements?: Movement[];
  instrumentation: InstrumentInfo[];
  genre?: string;
  difficulty?: DifficultyRating;
}
```

### Composer

```typescript
interface Composer {
  slug: string;
  name: string;               // "Ludwig van Beethoven"
  fullName: string;
  sortName: string;           // "Beethoven, Ludwig van"
  url: string;
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
  timePeriod?: TimePeriod;
  worksCount?: number;
}
```

### Score

```typescript
interface Score {
  id: string;
  filename: string;
  url: string;
  downloadUrl: string;
  editor?: string;
  publisher?: string;
  publicationYear?: number;
  pageCount?: number;
  fileSize?: number;
  scanQuality?: 'low' | 'medium' | 'high';
  isUrtext?: boolean;
}
```

## Error Handling

```typescript
import { NotFoundError, NetworkError, isIMSLPError } from 'easy-imslp';

try {
  await client.getWork('NonExistent_Work');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error(error.message);
    console.error(error.details.url);
    console.error(error.details.suggestion);
  } else if (isIMSLPError(error)) {
    console.error(`IMSLP Error: ${error.code}`);
  }
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `NotFoundError` | Resource not found |
| `NetworkError` | Network/connection issues |
| `RateLimitError` | Rate limit exceeded |
| `ParseError` | Failed to parse response |
| `TimeoutError` | Request timed out |

## Supported Catalogue Systems

The library recognizes these catalogue systems:

| System | Composer | Example |
|--------|----------|---------|
| BWV | Bach | BWV 1001 |
| K / KV | Mozart | K. 331, KV 331 |
| D | Schubert | D. 960 |
| Op | General | Op. 27 No. 2 |
| Hob | Haydn | Hob. XVI:52 |
| HWV | Handel | HWV 56 |
| RV | Vivaldi | RV 269 |
| WoO | Beethoven | WoO 59 |
| S | Liszt | S. 139 |
| WWV | Wagner | WWV 86 |
| TW | Telemann | TWV 51:D1 |
| L | Debussy | L. 75 |

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgments

- [IMSLP](https://imslp.org) for providing free access to public domain sheet music
- The MediaWiki API for making this library possible
