import type { TimePeriod } from './instrument.js';

/**
 * Minimal composer reference for embedding in Work
 */
export interface ComposerReference {
  /** IMSLP slug: "Beethoven,_Ludwig_van" */
  slug: string;
  /** Display name: "Ludwig van Beethoven" */
  name: string;
}

/**
 * Full composer information
 */
export interface Composer {
  /** IMSLP slug: "Beethoven,_Ludwig_van" */
  slug: string;
  /** Display name: "Ludwig van Beethoven" */
  name: string;
  /** Full formal name: "Ludwig van Beethoven" */
  fullName: string;
  /** Sort name: "Beethoven, Ludwig van" */
  sortName: string;
  /** Full IMSLP URL */
  url: string;
  /** Nationality */
  nationality?: string;
  /** Birth year */
  birthYear?: number;
  /** Death year (undefined if still alive) */
  deathYear?: number;
  /** Musical period */
  timePeriod?: TimePeriod;
  /** Number of works on IMSLP */
  worksCount?: number;
}
