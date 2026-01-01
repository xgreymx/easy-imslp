/**
 * Instrument normalizer for IMSLP data
 *
 * Normalizes various instrument name variants to canonical forms:
 * - "Vln.", "violin", "violins", "vn" -> "violin"
 * - "Pf", "pf.", "piano", "pianoforte" -> "piano"
 * etc.
 */

import type { Instrument, InstrumentInfo, KnownInstrument } from '../models/instrument.js';

/**
 * Instrument aliases mapping to canonical names
 * Key: lowercase alias, Value: canonical instrument name
 */
const INSTRUMENT_ALIASES: Record<string, KnownInstrument> = {
  // Piano
  piano: 'piano',
  pianoforte: 'piano',
  pf: 'piano',
  'pf.': 'piano',
  pno: 'piano',
  'pno.': 'piano',
  klavier: 'piano',
  keyboard: 'piano',
  kbd: 'piano',
  fortepiano: 'piano',
  fp: 'piano',

  // Violin
  violin: 'violin',
  violins: 'violin',
  vln: 'violin',
  'vln.': 'violin',
  vn: 'violin',
  'vn.': 'violin',
  'v.': 'violin',
  violino: 'violin',
  violine: 'violin',
  fiddle: 'violin',

  // Viola
  viola: 'viola',
  violas: 'viola',
  vla: 'viola',
  'vla.': 'viola',
  va: 'viola',
  'va.': 'viola',
  'alto (instrument)': 'viola',
  bratsche: 'viola',

  // Cello
  cello: 'cello',
  cellos: 'cello',
  violoncello: 'cello',
  vc: 'cello',
  'vc.': 'cello',
  vlc: 'cello',
  'vlc.': 'cello',

  // Double bass
  'double bass': 'double-bass',
  'double-bass': 'double-bass',
  doublebass: 'double-bass',
  contrabass: 'double-bass',
  bass: 'double-bass',
  cb: 'double-bass',
  'cb.': 'double-bass',
  db: 'double-bass',
  'db.': 'double-bass',
  kontrabass: 'double-bass',

  // Flute
  flute: 'flute',
  flutes: 'flute',
  fl: 'flute',
  'fl.': 'flute',
  flauto: 'flute',
  flauti: 'flute',
  flöte: 'flute',
  piccolo: 'flute',

  // Oboe
  oboe: 'oboe',
  oboes: 'oboe',
  ob: 'oboe',
  'ob.': 'oboe',
  oboi: 'oboe',
  hautbois: 'oboe',
  'english horn': 'oboe',
  'cor anglais': 'oboe',

  // Clarinet
  clarinet: 'clarinet',
  clarinets: 'clarinet',
  cl: 'clarinet',
  'cl.': 'clarinet',
  clar: 'clarinet',
  'clar.': 'clarinet',
  clarinetto: 'clarinet',
  klarinette: 'clarinet',
  'bass clarinet': 'clarinet',

  // Bassoon
  bassoon: 'bassoon',
  bassoons: 'bassoon',
  bsn: 'bassoon',
  'bsn.': 'bassoon',
  bn: 'bassoon',
  'bn.': 'bassoon',
  fagott: 'bassoon',
  fagotto: 'bassoon',
  contrabassoon: 'bassoon',
  contrafagotto: 'bassoon',

  // Horn
  horn: 'horn',
  horns: 'horn',
  hn: 'horn',
  'hn.': 'horn',
  hr: 'horn',
  'hr.': 'horn',
  cor: 'horn',
  corno: 'horn',
  corni: 'horn',
  'french horn': 'horn',
  waldhorn: 'horn',

  // Trumpet
  trumpet: 'trumpet',
  trumpets: 'trumpet',
  tpt: 'trumpet',
  'tpt.': 'trumpet',
  tr: 'trumpet',
  'tr.': 'trumpet',
  trp: 'trumpet',
  tromba: 'trumpet',
  trombe: 'trumpet',
  trompete: 'trumpet',
  cornet: 'trumpet',

  // Trombone
  trombone: 'trombone',
  trombones: 'trombone',
  trb: 'trombone',
  'trb.': 'trombone',
  tbn: 'trombone',
  'tbn.': 'trombone',
  posaune: 'trombone',
  'bass trombone': 'trombone',

  // Tuba
  tuba: 'tuba',
  tubas: 'tuba',
  tb: 'tuba',
  'tb.': 'tuba',
  euphonium: 'tuba',
  'baritone horn': 'tuba',
  sousaphone: 'tuba',

  // Voice
  voice: 'voice',
  voices: 'voice',
  vocal: 'voice',
  vocals: 'voice',
  v: 'voice',
  soprano: 'voice',
  mezzo: 'voice',
  'mezzo-soprano': 'voice',
  alto: 'voice',
  contralto: 'voice',
  tenor: 'voice',
  baritone: 'voice',
  'bass voice': 'voice',
  singer: 'voice',
  voce: 'voice',
  voci: 'voice',

  // Organ
  organ: 'organ',
  organs: 'organ',
  org: 'organ',
  'org.': 'organ',
  orgel: 'organ',
  organo: 'organ',
  'pipe organ': 'organ',
  harmonium: 'organ',

  // Guitar
  guitar: 'guitar',
  guitars: 'guitar',
  gtr: 'guitar',
  'gtr.': 'guitar',
  git: 'guitar',
  'git.': 'guitar',
  gitarre: 'guitar',
  chitarra: 'guitar',
  lute: 'guitar',
  'classical guitar': 'guitar',

  // Harp
  harp: 'harp',
  harps: 'harp',
  hp: 'harp',
  'hp.': 'harp',
  arpa: 'harp',
  harfe: 'harp',

  // Orchestra
  orchestra: 'orchestra',
  orch: 'orchestra',
  'orch.': 'orchestra',
  orchestral: 'orchestra',
  symphonic: 'orchestra',
  'symphony orchestra': 'orchestra',
  'full orchestra': 'orchestra',
  orchester: 'orchestra',

  // Chamber ensemble
  'chamber ensemble': 'chamber-ensemble',
  'chamber-ensemble': 'chamber-ensemble',
  ensemble: 'chamber-ensemble',
  chamber: 'chamber-ensemble',
  'string quartet': 'chamber-ensemble',
  'piano trio': 'chamber-ensemble',
  'wind quintet': 'chamber-ensemble',
  'brass quintet': 'chamber-ensemble',
  quartet: 'chamber-ensemble',
  quintet: 'chamber-ensemble',
  trio: 'chamber-ensemble',
  duet: 'chamber-ensemble',
  duo: 'chamber-ensemble',

  // Choir
  choir: 'choir',
  choirs: 'choir',
  chorus: 'choir',
  choral: 'choir',
  chor: 'choir',
  coro: 'choir',
  satb: 'choir',
  'mixed choir': 'choir',
  "men's choir": 'choir',
  "women's choir": 'choir',
  "children's choir": 'choir',
};

/**
 * Normalize an instrument name to its canonical form
 */
export function normalizeInstrument(raw: string): Instrument {
  if (!raw) return raw;

  const normalized = raw.toLowerCase().trim();

  // Direct lookup
  if (INSTRUMENT_ALIASES[normalized]) {
    return INSTRUMENT_ALIASES[normalized]!;
  }

  // Try without trailing period
  const withoutPeriod = normalized.replace(/\.$/, '');
  if (INSTRUMENT_ALIASES[withoutPeriod]) {
    return INSTRUMENT_ALIASES[withoutPeriod]!;
  }

  // Try removing plural 's'
  if (normalized.endsWith('s') && normalized.length > 2) {
    const singular = normalized.slice(0, -1);
    if (INSTRUMENT_ALIASES[singular]) {
      return INSTRUMENT_ALIASES[singular]!;
    }
  }

  // Try removing 'es' plural
  if (normalized.endsWith('es') && normalized.length > 3) {
    const singular = normalized.slice(0, -2);
    if (INSTRUMENT_ALIASES[singular]) {
      return INSTRUMENT_ALIASES[singular]!;
    }
  }

  // Return original if no match found
  return raw.trim();
}

/**
 * Create an InstrumentInfo object from a raw string
 */
export function parseInstrument(raw: string): InstrumentInfo {
  return {
    raw: raw.trim(),
    normalized: normalizeInstrument(raw),
  };
}

/**
 * Parse multiple instruments from a string
 * Handles various separators: comma, semicolon, "and", "&"
 */
export function parseInstruments(text: string): InstrumentInfo[] {
  if (!text) return [];

  // Split by common separators
  const parts = text
    .split(/[,;]|\band\b|&/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return parts.map(parseInstrument);
}

/**
 * Check if an instrument is a known instrument type
 */
export function isKnownInstrument(instrument: Instrument): instrument is KnownInstrument {
  const known: readonly string[] = [
    'piano', 'violin', 'viola', 'cello', 'double-bass',
    'flute', 'oboe', 'clarinet', 'bassoon',
    'horn', 'trumpet', 'trombone', 'tuba',
    'voice', 'organ', 'guitar', 'harp',
    'orchestra', 'chamber-ensemble', 'choir',
  ];
  return known.includes(instrument);
}

/**
 * Get the instrument family
 */
export function getInstrumentFamily(
  instrument: Instrument
): 'strings' | 'woodwinds' | 'brass' | 'keyboard' | 'vocal' | 'ensemble' | 'other' {
  const families: Record<string, 'strings' | 'woodwinds' | 'brass' | 'keyboard' | 'vocal' | 'ensemble'> = {
    violin: 'strings',
    viola: 'strings',
    cello: 'strings',
    'double-bass': 'strings',
    guitar: 'strings',
    harp: 'strings',

    flute: 'woodwinds',
    oboe: 'woodwinds',
    clarinet: 'woodwinds',
    bassoon: 'woodwinds',

    horn: 'brass',
    trumpet: 'brass',
    trombone: 'brass',
    tuba: 'brass',

    piano: 'keyboard',
    organ: 'keyboard',

    voice: 'vocal',
    choir: 'vocal',

    orchestra: 'ensemble',
    'chamber-ensemble': 'ensemble',
  };

  return families[instrument] ?? 'other';
}

/**
 * Sort instruments by typical score order
 */
export function sortInstruments(instruments: InstrumentInfo[]): InstrumentInfo[] {
  const order: Record<string, number> = {
    // Woodwinds
    flute: 1,
    oboe: 2,
    clarinet: 3,
    bassoon: 4,

    // Brass
    horn: 5,
    trumpet: 6,
    trombone: 7,
    tuba: 8,

    // Percussion (not in our list but for future)

    // Keyboards
    piano: 10,
    organ: 11,

    // Strings
    violin: 20,
    viola: 21,
    cello: 22,
    'double-bass': 23,
    guitar: 24,
    harp: 25,

    // Vocal
    voice: 30,
    choir: 31,

    // Ensembles
    orchestra: 40,
    'chamber-ensemble': 41,
  };

  return [...instruments].sort((a, b) => {
    const orderA = order[a.normalized] ?? 100;
    const orderB = order[b.normalized] ?? 100;
    return orderA - orderB;
  });
}
