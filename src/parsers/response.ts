/**
 * Response parsers for IMSLP data
 *
 * Parses raw API responses and wikitext into typed models.
 * Uses lenient parsing with warnings collection.
 */

import type { Composer, ComposerReference } from '../models/composer.js';
import type { Work, Movement, DifficultyRating } from '../models/work.js';
import type { Score } from '../models/score.js';
import type { TimePeriod } from '../models/instrument.js';
import type { ParseResult } from '../client/types.js';

import { findTemplate, extractTemplates, parseYear, stripWikiMarkup } from './wikitext.js';
import { parseCatalogue } from './catalogue.js';
import { parseInstruments } from './instrument.js';

/**
 * Warnings collector for lenient parsing
 */
class WarningsCollector {
  private warnings: string[] = [];

  add(message: string): void {
    this.warnings.push(message);
  }

  addIf(condition: boolean, message: string): void {
    if (condition) {
      this.warnings.push(message);
    }
  }

  get(): string[] {
    return [...this.warnings];
  }
}

/**
 * Parse composer data from wikitext
 */
export function parseComposerWikitext(
  wikitext: string,
  slug: string
): ParseResult<Composer> {
  const warnings = new WarningsCollector();

  // Find the Composer template
  const template = findTemplate(wikitext, 'Composer');

  const params = template?.params ?? {};

  // Parse name parts
  const firstName = params['first_name'] ?? params['firstname'] ?? '';
  const lastName = params['last_name'] ?? params['lastname'] ?? '';
  const fullName = params['full_name'] ?? params['fullname'] ?? '';

  // Build names
  let name = fullName;
  if (!name && firstName && lastName) {
    name = `${firstName} ${lastName}`;
  }
  if (!name) {
    // Fall back to slug
    name = formatSlugAsName(slug);
    warnings.add('Could not extract composer name from template, using slug');
  }

  const sortName = lastName && firstName ? `${lastName}, ${firstName}` : name;

  // Parse dates
  const birthYear = parseYear(params['birth_date'] ?? params['born'] ?? '');
  const deathYear = parseYear(params['death_date'] ?? params['died'] ?? '');

  warnings.addIf(!birthYear && !!params['birth_date'], `Could not parse birth date: ${params['birth_date']}`);
  warnings.addIf(!deathYear && !!params['death_date'], `Could not parse death date: ${params['death_date']}`);

  // Parse nationality and period
  const nationality = params['nationality'] ?? params['country'] ?? undefined;
  const timePeriod = parseTimePeriod(params['time_period'] ?? params['period'] ?? '');

  const composer: Composer = {
    slug,
    name,
    fullName: fullName || name,
    sortName,
    url: `https://imslp.org/wiki/Category:${encodeURIComponent(slug.replace(/ /g, '_'))}`,
    nationality,
    birthYear,
    deathYear,
    timePeriod,
  };

  return { data: composer, warnings: warnings.get() };
}

/**
 * Parse work data from wikitext
 */
export function parseWorkWikitext(
  wikitext: string,
  slug: string,
  composerSlug?: string
): ParseResult<Work> {
  const warnings = new WarningsCollector();

  // Find the Work template (might be called "Composition", "Imslpwork", etc.)
  const template =
    findTemplate(wikitext, 'Work') ??
    findTemplate(wikitext, 'Composition') ??
    findTemplate(wikitext, 'Imslpwork');

  const params = template?.params ?? {};

  // Parse title
  let title = params['work_title'] ?? params['worktitle'] ?? params['title'] ?? '';
  if (!title) {
    title = formatSlugAsTitle(slug);
    warnings.add('Could not extract work title from template, using slug');
  }

  // Parse opus/catalogue
  const opusStr = params['opus'] ?? params['opus_catalogue'] ?? '';
  const opus = opusStr || undefined;
  const catalogue = parseCatalogue(opusStr);

  // Build full title
  const fullTitle = opus ? `${title}, ${opus}` : title;

  // Parse key
  const key = params['key'] ?? params['tonality'] ?? undefined;

  // Parse year
  const yearStr = params['year'] ?? params['year_of_composition'] ?? params['composition_year'] ?? '';
  const year = parseYear(yearStr);
  warnings.addIf(!year && !!yearStr, `Could not parse composition year: ${yearStr}`);

  // Parse instrumentation
  const instrumentStr =
    params['instrumentation'] ?? params['instruments'] ?? params['scoring'] ?? '';
  const instrumentation = parseInstruments(instrumentStr);
  warnings.addIf(instrumentation.length === 0, 'No instrumentation data found');

  // Parse genre
  const genre = params['genre'] ?? params['form'] ?? undefined;

  // Parse difficulty
  const difficulty = parseDifficulty(params['difficulty'] ?? params['henle'] ?? '');

  // Parse movements
  const movements = parseMovements(wikitext, warnings);

  // Build composer reference
  const composerName = params['composer'] ?? formatSlugAsName(composerSlug ?? '');
  const composer: ComposerReference = {
    slug: composerSlug ?? extractComposerFromSlug(slug) ?? '',
    name: composerName,
  };

  const work: Work = {
    slug,
    title,
    fullTitle,
    url: `https://imslp.org/wiki/${encodeURIComponent(slug.replace(/ /g, '_'))}`,
    composer,
    opus,
    catalogue: catalogue ?? undefined,
    key,
    year,
    movements: movements.length > 0 ? movements : undefined,
    instrumentation,
    genre,
    difficulty,
  };

  return { data: work, warnings: warnings.get() };
}

/**
 * Parse score data from wikitext file section
 */
export function parseScoreWikitext(
  wikitext: string,
  filename: string
): ParseResult<Score> {
  const warnings = new WarningsCollector();

  // Find file templates
  const templates = extractTemplates(wikitext);
  const fileTemplate = templates.find(
    (t) =>
      t.name.toLowerCase().includes('file') ||
      t.name.toLowerCase().includes('score') ||
      t.name.toLowerCase().includes('pdf')
  );

  const params = fileTemplate?.params ?? {};

  // Parse metadata
  const editor = params['editor'] ?? params['arranger'] ?? undefined;
  const publisher = params['publisher'] ?? undefined;
  const publicationYear = parseYear(params['year'] ?? params['pub_year'] ?? '');
  const pageCount = parseInt(params['pages'] ?? params['page_count'] ?? '', 10) || undefined;

  // Parse quality indicators
  const scanQuality = parseScanQuality(params['scan_quality'] ?? params['quality'] ?? '');
  const isUrtext =
    /urtext/i.test(params['edition'] ?? '') ||
    /urtext/i.test(params['editor'] ?? '') ||
    /urtext/i.test(editor ?? '');

  const score: Score = {
    id: filename,
    filename,
    url: `https://imslp.org/wiki/File:${encodeURIComponent(filename)}`,
    downloadUrl: `https://imslp.org/wiki/Special:ImagefromIndex/${encodeURIComponent(filename)}`,
    editor,
    publisher,
    publicationYear,
    pageCount,
    scanQuality,
    isUrtext,
  };

  return { data: score, warnings: warnings.get() };
}

/**
 * Parse time period string to enum
 */
function parseTimePeriod(text: string): TimePeriod | undefined {
  const lower = text.toLowerCase();

  if (/medieval|middle ages/i.test(lower)) return 'medieval';
  if (/renaissance/i.test(lower)) return 'renaissance';
  if (/baroque/i.test(lower)) return 'baroque';
  if (/classical/i.test(lower)) return 'classical';
  if (/romantic/i.test(lower)) return 'romantic';
  if (/modern|20th century/i.test(lower)) return 'modern';
  if (/contemporary|21st century/i.test(lower)) return 'contemporary';

  return undefined;
}

/**
 * Parse difficulty rating
 */
function parseDifficulty(text: string): DifficultyRating | undefined {
  if (!text) return undefined;

  // Try to parse Henle level (1-9)
  const match = text.match(/(\d)/);
  if (match?.[1]) {
    const level = parseInt(match[1], 10);
    if (level >= 1 && level <= 9) {
      return {
        level,
        description: getDifficultyDescription(level),
      };
    }
  }

  // Try to parse text descriptions
  const lower = text.toLowerCase();
  if (/beginner|easy|elementary/i.test(lower)) {
    return { level: 2, description: 'Elementary' };
  }
  if (/intermediate/i.test(lower)) {
    return { level: 5, description: 'Intermediate' };
  }
  if (/advanced/i.test(lower)) {
    return { level: 7, description: 'Advanced' };
  }
  if (/virtuoso|professional/i.test(lower)) {
    return { level: 9, description: 'Virtuoso' };
  }

  return undefined;
}

/**
 * Get difficulty description for Henle level
 */
function getDifficultyDescription(level: number): string {
  const descriptions: Record<number, string> = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Moderately Easy',
    4: 'Moderate',
    5: 'Moderately Difficult',
    6: 'Difficult',
    7: 'Very Difficult',
    8: 'Advanced',
    9: 'Virtuoso',
  };
  return descriptions[level] ?? 'Unknown';
}

/**
 * Parse movements from wikitext
 */
function parseMovements(wikitext: string, _warnings: WarningsCollector): Movement[] {
  const movements: Movement[] = [];

  // Look for movement patterns in wikitext
  // Common formats:
  // # I. Allegro
  // 1. Allegro con brio
  // Movement 1: Allegro
  const movementPatterns = [
    /(?:^|\n)#\s*([IVXL]+)\.\s*(.+?)(?:\n|$)/gi,
    /(?:^|\n)(\d+)\.\s*(.+?)(?:\n|$)/gi,
    /Movement\s+(\d+)[:\s]+(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of movementPatterns) {
    let match;
    while ((match = pattern.exec(wikitext)) !== null) {
      const numStr = match[1] ?? '';
      const content = match[2]?.trim() ?? '';

      let number: number;
      if (/^\d+$/.test(numStr)) {
        number = parseInt(numStr, 10);
      } else {
        // Roman numeral
        number = parseRomanNumeral(numStr);
      }

      if (number > 0 && content) {
        // Parse tempo and key from content
        const { title, tempo, key } = parseMovementContent(content);

        // Avoid duplicates
        if (!movements.some((m) => m.number === number)) {
          movements.push({ number, title, tempo, key });
        }
      }
    }
  }

  // Sort by movement number
  movements.sort((a, b) => a.number - b.number);

  return movements;
}

/**
 * Parse movement content to extract tempo and key
 */
function parseMovementContent(content: string): { title?: string; tempo?: string; key?: string } {
  const cleaned = stripWikiMarkup(content);

  // Common tempo markings
  const tempos = [
    'Largo', 'Larghetto', 'Lento', 'Adagio', 'Andante', 'Andantino',
    'Moderato', 'Allegretto', 'Allegro', 'Vivace', 'Presto', 'Prestissimo',
    'Grave', 'Maestoso', 'Scherzo', 'Menuet', 'Minuet', 'Rondo', 'Finale',
  ];

  // Check if content starts with a tempo marking
  for (const tempo of tempos) {
    if (cleaned.toLowerCase().startsWith(tempo.toLowerCase())) {
      return { tempo: cleaned };
    }
  }

  // Check for key in content (e.g., "in C major")
  const keyMatch = cleaned.match(/in\s+([A-G][#b]?\s*(?:major|minor|dur|moll)?)/i);
  const key = keyMatch?.[1]?.trim();

  return {
    title: cleaned,
    tempo: undefined,
    key,
  };
}

/**
 * Parse Roman numeral to number
 */
function parseRomanNumeral(roman: string): number {
  const values: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };

  let result = 0;
  const upper = roman.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    const current = values[upper[i]!] ?? 0;
    const next = values[upper[i + 1]!] ?? 0;

    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }

  return result;
}

/**
 * Parse scan quality
 */
function parseScanQuality(text: string): 'low' | 'medium' | 'high' | undefined {
  if (!text) return undefined;

  const lower = text.toLowerCase();
  if (/high|excellent|good/i.test(lower)) return 'high';
  if (/medium|fair|average/i.test(lower)) return 'medium';
  if (/low|poor|bad/i.test(lower)) return 'low';

  return undefined;
}

/**
 * Format a slug as a display name
 */
function formatSlugAsName(slug: string): string {
  if (!slug) return '';

  // "Beethoven,_Ludwig_van" -> "Ludwig van Beethoven"
  const parts = slug.replace(/_/g, ' ').split(',').map((s) => s.trim());

  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }

  return parts.join(', ');
}

/**
 * Format a slug as a work title
 */
function formatSlugAsTitle(slug: string): string {
  if (!slug) return '';

  // "Piano_Sonata_No.14_(Beethoven,_Ludwig_van)" -> "Piano Sonata No.14"
  return slug
    .replace(/_/g, ' ')
    .replace(/\s*\([^)]+\)\s*$/, '') // Remove composer suffix
    .trim();
}

/**
 * Extract composer slug from a work slug
 */
function extractComposerFromSlug(workSlug: string): string | undefined {
  // "Piano_Sonata_No.14_(Beethoven,_Ludwig_van)" -> "Beethoven,_Ludwig_van"
  const match = workSlug.match(/\(([^)]+)\)$/);
  return match?.[1]?.replace(/_/g, ' ');
}

/**
 * Create a composer reference from minimal data
 */
export function createComposerReference(
  slug: string,
  name?: string
): ComposerReference {
  return {
    slug,
    name: name ?? formatSlugAsName(slug),
  };
}
