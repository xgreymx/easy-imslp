import type { ComposerReference } from './composer.js';
import type { CatalogueInfo } from './catalogue.js';
import type { InstrumentInfo } from './instrument.js';

/**
 * Movement within a work
 */
export interface Movement {
  /** Movement number (1-indexed) */
  number: number;
  /** Movement title if available */
  title?: string;
  /** Tempo marking: "Allegro", "Andante", etc. */
  tempo?: string;
  /** Key of the movement */
  key?: string;
}

/**
 * Difficulty rating from IMSLP
 */
export interface DifficultyRating {
  /** Numeric level (1-9 Henle scale) */
  level: number;
  /** Human-readable description: "Intermediate", "Advanced", etc. */
  description: string;
}

/**
 * Validation issue found in work data
 */
export interface ValidationIssue {
  /** Field that has an issue */
  field: string;
  /** Description of the issue */
  message: string;
  /** Severity level */
  severity: 'warning' | 'error';
}

/**
 * Result of validating work data
 */
export interface ValidationResult {
  /** Whether the data is valid (no errors, warnings allowed) */
  valid: boolean;
  /** List of issues found */
  issues: ValidationIssue[];
}

/**
 * Musical work/piece
 */
export interface Work {
  /** IMSLP slug */
  slug: string;
  /** Short title: "Piano Sonata No.14" */
  title: string;
  /** Full title with opus: "Piano Sonata No.14, Op.27 No.2" */
  fullTitle: string;
  /** Full IMSLP URL */
  url: string;
  /** Composer reference */
  composer: ComposerReference;

  // Catalog information
  /** Opus string: "Op.27 No.2" */
  opus?: string;
  /** Parsed catalogue reference */
  catalogue?: CatalogueInfo;

  // Metadata
  /** Musical key: "C-sharp minor" */
  key?: string;
  /** Composition year */
  year?: number;
  /** List of movements */
  movements?: Movement[];
  /** Instrumentation */
  instrumentation: InstrumentInfo[];
  /** Genre/form */
  genre?: string;

  // Difficulty (only when IMSLP provides it)
  /** Difficulty rating */
  difficulty?: DifficultyRating;
}

/**
 * Enriched work with scraped data
 */
export interface EnrichedWork extends Work {
  /** Total download count across all scores */
  downloadCount?: number;
  /** Average user rating */
  userRating?: number;
}

/**
 * Work with validation method
 */
export interface WorkWithMethods extends Work {
  /** Validate the work data */
  validate(): ValidationResult;
  /** Fetch enriched data (download count, ratings) */
  enrich(): Promise<EnrichedWork>;
}
