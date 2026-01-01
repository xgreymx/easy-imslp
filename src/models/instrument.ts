/**
 * Known instrument types for type-safe filtering
 */
export type KnownInstrument =
  | 'piano'
  | 'violin'
  | 'viola'
  | 'cello'
  | 'double-bass'
  | 'flute'
  | 'oboe'
  | 'clarinet'
  | 'bassoon'
  | 'horn'
  | 'trumpet'
  | 'trombone'
  | 'tuba'
  | 'voice'
  | 'organ'
  | 'guitar'
  | 'harp'
  | 'orchestra'
  | 'chamber-ensemble'
  | 'choir';

/**
 * Instrument type - known instruments or custom string
 */
export type Instrument = KnownInstrument | (string & {});

/**
 * Instrument with both raw IMSLP string and normalized value
 */
export interface InstrumentInfo {
  /** Original string from IMSLP: "Vln.", "violins", etc. */
  raw: string;
  /** Canonical normalized value: "violin" */
  normalized: Instrument;
}

/**
 * Musical time periods
 */
export type TimePeriod =
  | 'medieval'
  | 'renaissance'
  | 'baroque'
  | 'classical'
  | 'romantic'
  | 'modern'
  | 'contemporary';
