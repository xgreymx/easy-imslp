/**
 * Formatting utilities for IMSLP data
 */

import type { Work } from '../models/work.js';
import type { InstrumentInfo } from '../models/instrument.js';

/**
 * Format style for composer names
 */
export type ComposerNameStyle = 'full' | 'short' | 'sort';

/**
 * Format a composer slug into a readable name
 *
 * @example
 * ```typescript
 * formatComposerName('Beethoven,_Ludwig_van', 'full');  // "Ludwig van Beethoven"
 * formatComposerName('Beethoven,_Ludwig_van', 'short'); // "Beethoven"
 * formatComposerName('Beethoven,_Ludwig_van', 'sort');  // "Beethoven, Ludwig van"
 * ```
 */
export function formatComposerName(slug: string, style: ComposerNameStyle = 'full'): string {
  if (!slug) return '';

  // Normalize the slug
  const normalized = slug.replace(/_/g, ' ').trim();

  // Split by comma
  const parts = normalized.split(',').map((s) => s.trim());

  if (parts.length < 2) {
    // No comma, return as-is
    return normalized;
  }

  const lastName = parts[0] ?? '';
  const firstName = parts.slice(1).join(' ');

  switch (style) {
    case 'full':
      return `${firstName} ${lastName}`.trim();
    case 'short':
      return lastName;
    case 'sort':
      return `${lastName}, ${firstName}`.trim();
    default:
      return `${firstName} ${lastName}`.trim();
  }
}

/**
 * Format a work title with optional opus
 */
export function formatWorkTitle(title: string, opus?: string): string {
  if (!title) return '';
  if (!opus) return title;
  return `${title}, ${opus}`;
}

/**
 * Format a year range for display
 */
export function formatYearRange(startYear?: number, endYear?: number): string {
  if (!startYear && !endYear) return '';
  if (startYear && !endYear) return `${startYear}–`;
  if (!startYear && endYear) return `–${endYear}`;
  if (startYear === endYear) return String(startYear);
  return `${startYear}–${endYear}`;
}

/**
 * Format composer lifespan
 */
export function formatLifespan(birthYear?: number, deathYear?: number): string {
  if (!birthYear && !deathYear) return '';
  if (birthYear && !deathYear) return `b. ${birthYear}`;
  if (!birthYear && deathYear) return `d. ${deathYear}`;
  return `${birthYear}–${deathYear}`;
}

/**
 * Group works by their primary instrument
 *
 * @example
 * ```typescript
 * const grouped = groupByInstrument(works);
 * // { piano: [...], violin: [...], orchestra: [...] }
 * ```
 */
export function groupByInstrument(works: Work[]): Record<string, Work[]> {
  const groups: Record<string, Work[]> = {};

  for (const work of works) {
    // Get primary instrument (first one)
    const primary = work.instrumentation[0]?.normalized ?? 'unknown';

    if (!groups[primary]) {
      groups[primary] = [];
    }
    groups[primary].push(work);
  }

  return groups;
}

/**
 * Group works by genre
 */
export function groupByGenre(works: Work[]): Record<string, Work[]> {
  const groups: Record<string, Work[]> = {};

  for (const work of works) {
    const genre = work.genre ?? 'unknown';

    if (!groups[genre]) {
      groups[genre] = [];
    }
    groups[genre].push(work);
  }

  return groups;
}

/**
 * Group works by composer
 */
export function groupByComposer(works: Work[]): Record<string, Work[]> {
  const groups: Record<string, Work[]> = {};

  for (const work of works) {
    const composerSlug = work.composer.slug || 'unknown';

    if (!groups[composerSlug]) {
      groups[composerSlug] = [];
    }
    groups[composerSlug].push(work);
  }

  return groups;
}

/**
 * Format instrumentation for display
 *
 * @example
 * ```typescript
 * formatInstrumentation([{ raw: 'vln', normalized: 'violin' }, { raw: 'pf', normalized: 'piano' }])
 * // "violin, piano"
 * ```
 */
export function formatInstrumentation(instruments: InstrumentInfo[], useRaw = false): string {
  if (!instruments || instruments.length === 0) return '';

  return instruments
    .map((i) => (useRaw ? i.raw : i.normalized))
    .join(', ');
}

/**
 * Slugify a string for URL use
 */
export function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.(),]/g, '');
}

/**
 * Unslugify a string for display
 */
export function unslugify(slug: string): string {
  return slug.replace(/_/g, ' ').trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Title case a string
 */
export function titleCase(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
