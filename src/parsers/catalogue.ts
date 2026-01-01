/**
 * Catalogue system parser for classical music works
 *
 * Parses various catalogue numbering systems used in classical music:
 * - Opus numbers (Op., op.)
 * - BWV (Bach-Werke-Verzeichnis)
 * - K/KV (Köchel - Mozart)
 * - D (Deutsch - Schubert)
 * - Hob (Hoboken - Haydn)
 * - HWV (Händel-Werke-Verzeichnis)
 * - RV (Ryom-Verzeichnis - Vivaldi)
 * - WoO (Werke ohne Opuszahl)
 * - S (Searle - Liszt)
 * - WWV (Wagner-Werk-Verzeichnis)
 * - L (Longo - Scarlatti)
 * - K/Kk (Kirkpatrick - Scarlatti)
 */

import type { CatalogueInfo, CatalogueSystem } from '../models/catalogue.js';

/**
 * Catalogue system patterns
 * Order matters - more specific patterns should come first
 */
const CATALOGUE_PATTERNS: Array<{
  system: CatalogueSystem;
  patterns: RegExp[];
}> = [
  {
    system: 'bwv',
    patterns: [
      /\bBWV\s*\.?\s*(\d+)([a-z])?(?:\s*\/\s*(\d+))?/i,
    ],
  },
  {
    system: 'k',
    patterns: [
      /\bK(?:V|\.)\s*(\d+)([a-z])?/i, // KV or K.
      /\bKöchel\s*(\d+)([a-z])?/i,
    ],
  },
  {
    system: 'd',
    patterns: [
      /\bD\.?\s*(\d+)([a-z])?/i, // D or D.
      /\bDeutsch\s*(\d+)/i,
    ],
  },
  {
    system: 'hob',
    patterns: [
      /\bHob\.?\s*([IVX]+)[:/]?\s*(\d+)/i, // Hob.XVI:52
      /\bHoboken\s*([IVX]+)[:/]?\s*(\d+)/i,
    ],
  },
  {
    system: 'hwv',
    patterns: [
      /\bHWV\s*\.?\s*(\d+)([a-z])?/i,
    ],
  },
  {
    system: 'rv',
    patterns: [
      /\bRV\s*\.?\s*(\d+)([a-z])?/i,
      /\bRyom\s*(\d+)/i,
    ],
  },
  {
    system: 'woo',
    patterns: [
      /\bWoO\s*\.?\s*(\d+)/i,
    ],
  },
  {
    system: 's',
    patterns: [
      /\bS\.?\s*(\d+)([a-z])?/i, // S. for Searle (Liszt)
    ],
  },
  {
    system: 'wwv',
    patterns: [
      /\bWWV\s*\.?\s*(\d+)/i,
    ],
  },
  {
    system: 'tw',
    patterns: [
      /\bTWV\s*\.?\s*(\d+)[:/](\d+)/i, // TWV 51:D1
    ],
  },
  {
    system: 'l',
    patterns: [
      /\bL\.?\s*(\d+)/i, // Longo (Scarlatti)
    ],
  },
  // Opus should be last as it's most generic
  {
    system: 'op',
    patterns: [
      /\bOp(?:us)?\.?\s*(\d+)(?:\s*(?:No\.?|Nr\.?|,)\s*(\d+))?/i,
      /\bOp(?:us)?\.?\s*posth(?:umous)?\.?/i, // Op. posth.
    ],
  },
];

/**
 * Parse a catalogue number string
 */
export function parseCatalogue(text: string): CatalogueInfo | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Try each catalogue system
  for (const { system, patterns } of CATALOGUE_PATTERNS) {
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return parseCatalogueMatch(trimmed, system, match);
      }
    }
  }

  // If no known system matched, return raw string only
  // Check if it looks like a catalogue number (has numbers)
  if (/\d/.test(trimmed)) {
    return {
      raw: trimmed,
    };
  }

  return null;
}

/**
 * Parse a matched catalogue number
 */
function parseCatalogueMatch(
  raw: string,
  system: CatalogueSystem,
  match: RegExpMatchArray
): CatalogueInfo {
  const result: CatalogueInfo = {
    raw,
    system,
  };

  // Handle Hoboken special case (Roman numerals + number)
  if (system === 'hob' && match[1] && match[2]) {
    result.number = parseInt(match[2], 10);
    result.suffix = match[1]; // Roman numeral category
    return result;
  }

  // Handle TWV special case
  if (system === 'tw' && match[1] && match[2]) {
    result.number = parseInt(match[1], 10);
    result.suffix = match[2];
    return result;
  }

  // Handle Opus with sub-number
  if (system === 'op') {
    // Check for "Op. posth."
    if (/posth/i.test(raw)) {
      result.suffix = 'posth.';
      return result;
    }

    if (match[1]) {
      result.number = parseInt(match[1], 10);
    }
    if (match[2]) {
      result.suffix = `No.${match[2]}`;
    }
    return result;
  }

  // Standard case: number with optional letter suffix
  if (match[1]) {
    result.number = parseInt(match[1], 10);
  }
  if (match[2]) {
    result.suffix = match[2].toLowerCase();
  }

  return result;
}

/**
 * Parse multiple catalogue numbers from a string
 * (e.g., "Op.27 No.2; BWV 1001")
 */
export function parseAllCatalogues(text: string): CatalogueInfo[] {
  if (!text) return [];

  const results: CatalogueInfo[] = [];

  // Split by common separators
  const parts = text.split(/[;,]\s*/);

  for (const part of parts) {
    const parsed = parseCatalogue(part.trim());
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Format a catalogue info back to a string
 */
export function formatCatalogue(info: CatalogueInfo): string {
  if (!info.system || !info.number) {
    return info.raw;
  }

  const prefix = SYSTEM_PREFIXES[info.system] ?? info.system.toUpperCase();

  let result = `${prefix} ${info.number}`;
  if (info.suffix) {
    // Handle special cases
    if (info.system === 'op' && info.suffix.startsWith('No')) {
      result += ` ${info.suffix}`;
    } else if (info.system === 'hob') {
      result = `${prefix} ${info.suffix}:${info.number}`;
    } else {
      result += info.suffix;
    }
  }

  return result;
}

/**
 * Standard prefixes for each catalogue system
 */
const SYSTEM_PREFIXES: Record<string, string> = {
  op: 'Op.',
  bwv: 'BWV',
  k: 'K.',
  d: 'D.',
  hob: 'Hob.',
  hwv: 'HWV',
  rv: 'RV',
  woo: 'WoO',
  s: 'S.',
  wwv: 'WWV',
  tw: 'TWV',
  l: 'L.',
};

/**
 * Get the full name of a catalogue system
 */
export function getCatalogueSystemName(system: CatalogueSystem): string {
  const names: Record<string, string> = {
    op: 'Opus',
    bwv: 'Bach-Werke-Verzeichnis',
    k: 'Köchel (Mozart)',
    d: 'Deutsch (Schubert)',
    hob: 'Hoboken (Haydn)',
    hwv: 'Händel-Werke-Verzeichnis',
    rv: 'Ryom-Verzeichnis (Vivaldi)',
    woo: 'Werke ohne Opuszahl',
    s: 'Searle (Liszt)',
    wwv: 'Wagner-Werk-Verzeichnis',
    tw: 'Telemann-Werke-Verzeichnis',
    l: 'Longo (Scarlatti)',
  };

  return names[system] ?? system;
}

/**
 * Extract opus number specifically (common use case)
 */
export function parseOpus(text: string): { opus?: number; number?: number } | null {
  if (!text) return null;

  const match = text.match(/\bOp(?:us)?\.?\s*(\d+)(?:\s*(?:No\.?|Nr\.?|,)\s*(\d+))?/i);
  if (!match) return null;

  return {
    opus: match[1] ? parseInt(match[1], 10) : undefined,
    number: match[2] ? parseInt(match[2], 10) : undefined,
  };
}

/**
 * Compare two catalogue numbers for sorting
 */
export function compareCatalogues(a: CatalogueInfo, b: CatalogueInfo): number {
  // First compare by system
  if (a.system && b.system && a.system !== b.system) {
    return a.system.localeCompare(b.system);
  }

  // Then by number
  const aNum = a.number ?? 0;
  const bNum = b.number ?? 0;
  if (aNum !== bNum) {
    return aNum - bNum;
  }

  // Finally by suffix
  const aSuffix = a.suffix ?? '';
  const bSuffix = b.suffix ?? '';
  return aSuffix.localeCompare(bSuffix);
}
