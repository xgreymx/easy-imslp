import type { ValidationResult } from './work.js';

/**
 * Scan quality indicator
 */
export type ScanQuality = 'low' | 'medium' | 'high';

/**
 * Score/PDF file from IMSLP
 */
export interface Score {
  /** Unique identifier */
  id: string;
  /** Filename on IMSLP */
  filename: string;
  /** Page URL on IMSLP */
  url: string;
  /** Direct download URL */
  downloadUrl: string;

  // Edition info
  /** Editor/edition: "Henle", "Schirmer", "Peters" */
  editor?: string;
  /** Publisher name */
  publisher?: string;
  /** Year of publication */
  publicationYear?: number;
  /** Number of pages */
  pageCount?: number;
  /** File size in bytes */
  fileSize?: number;

  // Quality indicators
  /** Scan quality assessment */
  scanQuality?: ScanQuality;
  /** Whether this is an Urtext edition */
  isUrtext?: boolean;
}

/**
 * Score with validation method
 */
export interface ScoreWithMethods extends Score {
  /** Validate the score data */
  validate(): ValidationResult;
}
