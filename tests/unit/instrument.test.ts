import { describe, it, expect } from 'vitest';
import {
  normalizeInstrument,
  parseInstrument,
  parseInstruments,
  isKnownInstrument,
  getInstrumentFamily,
  sortInstruments,
} from '../../src/parsers/instrument.js';

describe('normalizeInstrument', () => {
  describe('Piano variants', () => {
    it('should normalize piano abbreviations', () => {
      expect(normalizeInstrument('pf')).toBe('piano');
      expect(normalizeInstrument('pf.')).toBe('piano');
      expect(normalizeInstrument('pno')).toBe('piano');
      expect(normalizeInstrument('pno.')).toBe('piano');
    });

    it('should normalize piano synonyms', () => {
      expect(normalizeInstrument('pianoforte')).toBe('piano');
      expect(normalizeInstrument('klavier')).toBe('piano');
      expect(normalizeInstrument('fortepiano')).toBe('piano');
    });
  });

  describe('String instruments', () => {
    it('should normalize violin variants', () => {
      expect(normalizeInstrument('violin')).toBe('violin');
      expect(normalizeInstrument('violins')).toBe('violin');
      expect(normalizeInstrument('vln')).toBe('violin');
      expect(normalizeInstrument('vln.')).toBe('violin');
      expect(normalizeInstrument('vn')).toBe('violin');
    });

    it('should normalize viola variants', () => {
      expect(normalizeInstrument('viola')).toBe('viola');
      expect(normalizeInstrument('vla')).toBe('viola');
      expect(normalizeInstrument('va')).toBe('viola');
    });

    it('should normalize cello variants', () => {
      expect(normalizeInstrument('cello')).toBe('cello');
      expect(normalizeInstrument('violoncello')).toBe('cello');
      expect(normalizeInstrument('vc')).toBe('cello');
      expect(normalizeInstrument('vlc')).toBe('cello');
    });
  });

  describe('Woodwinds', () => {
    it('should normalize flute', () => {
      expect(normalizeInstrument('flute')).toBe('flute');
      expect(normalizeInstrument('fl')).toBe('flute');
      expect(normalizeInstrument('fl.')).toBe('flute');
      expect(normalizeInstrument('flauto')).toBe('flute');
    });

    it('should normalize clarinet', () => {
      expect(normalizeInstrument('clarinet')).toBe('clarinet');
      expect(normalizeInstrument('cl')).toBe('clarinet');
      expect(normalizeInstrument('cl.')).toBe('clarinet');
    });
  });

  describe('Voice', () => {
    it('should normalize voice variants', () => {
      expect(normalizeInstrument('voice')).toBe('voice');
      expect(normalizeInstrument('vocal')).toBe('voice');
      expect(normalizeInstrument('soprano')).toBe('voice');
      expect(normalizeInstrument('tenor')).toBe('voice');
      expect(normalizeInstrument('baritone')).toBe('voice');
    });
  });

  describe('Ensembles', () => {
    it('should normalize orchestra', () => {
      expect(normalizeInstrument('orchestra')).toBe('orchestra');
      expect(normalizeInstrument('orch')).toBe('orchestra');
      expect(normalizeInstrument('orch.')).toBe('orchestra');
    });

    it('should normalize choir', () => {
      expect(normalizeInstrument('choir')).toBe('choir');
      expect(normalizeInstrument('chorus')).toBe('choir');
      expect(normalizeInstrument('choral')).toBe('choir');
      expect(normalizeInstrument('SATB')).toBe('choir');
    });
  });

  describe('Unknown instruments', () => {
    it('should return original for unknown instruments', () => {
      expect(normalizeInstrument('theremin')).toBe('theremin');
      expect(normalizeInstrument('synthesizer')).toBe('synthesizer');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeInstrument('PIANO')).toBe('piano');
      expect(normalizeInstrument('Violin')).toBe('violin');
    });
  });
});

describe('parseInstrument', () => {
  it('should return InstrumentInfo object', () => {
    const result = parseInstrument('vln.');
    expect(result).toEqual({ raw: 'vln.', normalized: 'violin' });
  });

  it('should preserve raw value', () => {
    const result = parseInstrument('  Piano  ');
    expect(result.raw).toBe('Piano');
    expect(result.normalized).toBe('piano');
  });
});

describe('parseInstruments', () => {
  it('should split by comma', () => {
    const result = parseInstruments('violin, viola, cello');
    expect(result).toHaveLength(3);
    expect(result[0]?.normalized).toBe('violin');
    expect(result[1]?.normalized).toBe('viola');
    expect(result[2]?.normalized).toBe('cello');
  });

  it('should split by semicolon', () => {
    const result = parseInstruments('violin; piano');
    expect(result).toHaveLength(2);
  });

  it('should split by "and"', () => {
    const result = parseInstruments('violin and piano');
    expect(result).toHaveLength(2);
  });

  it('should handle empty input', () => {
    expect(parseInstruments('')).toEqual([]);
    expect(parseInstruments(null as any)).toEqual([]);
  });
});

describe('isKnownInstrument', () => {
  it('should return true for known instruments', () => {
    expect(isKnownInstrument('piano')).toBe(true);
    expect(isKnownInstrument('violin')).toBe(true);
    expect(isKnownInstrument('orchestra')).toBe(true);
  });

  it('should return false for unknown instruments', () => {
    expect(isKnownInstrument('theremin')).toBe(false);
    expect(isKnownInstrument('unknown')).toBe(false);
  });
});

describe('getInstrumentFamily', () => {
  it('should return correct families', () => {
    expect(getInstrumentFamily('violin')).toBe('strings');
    expect(getInstrumentFamily('cello')).toBe('strings');
    expect(getInstrumentFamily('flute')).toBe('woodwinds');
    expect(getInstrumentFamily('clarinet')).toBe('woodwinds');
    expect(getInstrumentFamily('trumpet')).toBe('brass');
    expect(getInstrumentFamily('horn')).toBe('brass');
    expect(getInstrumentFamily('piano')).toBe('keyboard');
    expect(getInstrumentFamily('organ')).toBe('keyboard');
    expect(getInstrumentFamily('voice')).toBe('vocal');
    expect(getInstrumentFamily('choir')).toBe('vocal');
    expect(getInstrumentFamily('orchestra')).toBe('ensemble');
  });

  it('should return "other" for unknown', () => {
    expect(getInstrumentFamily('theremin')).toBe('other');
  });
});

describe('sortInstruments', () => {
  it('should sort by typical score order', () => {
    const instruments = [
      { raw: 'cello', normalized: 'cello' as const },
      { raw: 'flute', normalized: 'flute' as const },
      { raw: 'violin', normalized: 'violin' as const },
      { raw: 'trumpet', normalized: 'trumpet' as const },
    ];

    const sorted = sortInstruments(instruments);

    expect(sorted[0]?.normalized).toBe('flute'); // Woodwinds first
    expect(sorted[1]?.normalized).toBe('trumpet'); // Then brass
    expect(sorted[2]?.normalized).toBe('violin'); // Then strings
    expect(sorted[3]?.normalized).toBe('cello');
  });

  it('should not mutate original array', () => {
    const original = [
      { raw: 'cello', normalized: 'cello' as const },
      { raw: 'violin', normalized: 'violin' as const },
    ];
    const originalCopy = [...original];

    sortInstruments(original);

    expect(original).toEqual(originalCopy);
  });
});
