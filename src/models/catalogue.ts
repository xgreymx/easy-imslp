/**
 * Known catalogue systems for classical music
 */
export type KnownCatalogueSystem =
  | 'op' // Opus (general)
  | 'bwv' // Bach-Werke-Verzeichnis
  | 'k' // Köchel (Mozart)
  | 'd' // Deutsch (Schubert)
  | 'hwv' // Händel-Werke-Verzeichnis
  | 'hob' // Hoboken (Haydn)
  | 'rv' // Ryom-Verzeichnis (Vivaldi)
  | 'woo' // Werke ohne Opuszahl
  | 's' // Searle (Liszt)
  | 'wwv' // Wagner-Werk-Verzeichnis
  | 'tw' // Telemann-Werke-Verzeichnis
  | 'l' // Longo (Scarlatti)
  | 'kk' // Kirkpatrick (Scarlatti);

/**
 * Catalogue system - known systems or custom string
 */
export type CatalogueSystem = KnownCatalogueSystem | (string & {});

/**
 * Parsed catalogue information
 */
export interface CatalogueInfo {
  /** Original string: "BWV 1001", "Op.27 No.2" */
  raw: string;
  /** Recognized system: 'bwv', 'op', etc. */
  system?: CatalogueSystem;
  /** Primary number: 1001, 27, etc. */
  number?: number;
  /** Additional suffix: "No.2", "a", etc. */
  suffix?: string;
}
