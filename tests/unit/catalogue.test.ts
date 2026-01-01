import { describe, it, expect } from 'vitest';
import {
  parseCatalogue,
  parseAllCatalogues,
  parseOpus,
  formatCatalogue,
  getCatalogueSystemName,
  compareCatalogues,
} from '../../src/parsers/catalogue.js';

describe('parseCatalogue', () => {
  describe('Opus numbers', () => {
    it('should parse simple opus', () => {
      const result = parseCatalogue('Op. 27');
      expect(result).toEqual({ raw: 'Op. 27', system: 'op', number: 27 });
    });

    it('should parse opus with number', () => {
      const result = parseCatalogue('Op. 27 No. 2');
      expect(result).toEqual({ raw: 'Op. 27 No. 2', system: 'op', number: 27, suffix: 'No.2' });
    });

    it('should parse "Opus" spelled out', () => {
      const result = parseCatalogue('Opus 27');
      expect(result?.system).toBe('op');
      expect(result?.number).toBe(27);
    });

    it('should parse Op. posth.', () => {
      const result = parseCatalogue('Op. posth.');
      expect(result?.system).toBe('op');
      expect(result?.suffix).toBe('posth.');
    });
  });

  describe('BWV (Bach)', () => {
    it('should parse BWV numbers', () => {
      const result = parseCatalogue('BWV 1001');
      expect(result).toEqual({ raw: 'BWV 1001', system: 'bwv', number: 1001 });
    });

    it('should parse BWV with letter suffix', () => {
      const result = parseCatalogue('BWV 1001a');
      expect(result).toEqual({ raw: 'BWV 1001a', system: 'bwv', number: 1001, suffix: 'a' });
    });
  });

  describe('K/KV (Mozart)', () => {
    it('should parse K. numbers', () => {
      const result = parseCatalogue('K. 331');
      expect(result?.system).toBe('k');
      expect(result?.number).toBe(331);
    });

    it('should parse KV numbers', () => {
      const result = parseCatalogue('KV 331');
      expect(result?.system).toBe('k');
      expect(result?.number).toBe(331);
    });
  });

  describe('D (Schubert)', () => {
    it('should parse D numbers', () => {
      const result = parseCatalogue('D. 960');
      expect(result?.system).toBe('d');
      expect(result?.number).toBe(960);
    });

    it('should parse D without period', () => {
      const result = parseCatalogue('D 960');
      expect(result?.system).toBe('d');
      expect(result?.number).toBe(960);
    });
  });

  describe('Hob (Haydn)', () => {
    it('should parse Hob numbers with Roman numerals', () => {
      const result = parseCatalogue('Hob. XVI:52');
      expect(result?.system).toBe('hob');
      expect(result?.number).toBe(52);
      expect(result?.suffix).toBe('XVI');
    });
  });

  describe('Other systems', () => {
    it('should parse HWV (Handel)', () => {
      const result = parseCatalogue('HWV 56');
      expect(result?.system).toBe('hwv');
      expect(result?.number).toBe(56);
    });

    it('should parse RV (Vivaldi)', () => {
      const result = parseCatalogue('RV 269');
      expect(result?.system).toBe('rv');
      expect(result?.number).toBe(269);
    });

    it('should parse WoO', () => {
      const result = parseCatalogue('WoO 59');
      expect(result?.system).toBe('woo');
      expect(result?.number).toBe(59);
    });
  });

  describe('Edge cases', () => {
    it('should return null for empty input', () => {
      expect(parseCatalogue('')).toBeNull();
      expect(parseCatalogue(null as any)).toBeNull();
    });

    it('should return raw for unrecognized format with numbers', () => {
      const result = parseCatalogue('Custom 123');
      expect(result?.raw).toBe('Custom 123');
      expect(result?.system).toBeUndefined();
    });

    it('should return null for text without numbers', () => {
      expect(parseCatalogue('Just text')).toBeNull();
    });
  });
});

describe('parseAllCatalogues', () => {
  it('should parse multiple catalogues', () => {
    const result = parseAllCatalogues('Op. 27; BWV 1001');
    expect(result).toHaveLength(2);
    expect(result[0]?.system).toBe('op');
    expect(result[1]?.system).toBe('bwv');
  });

  it('should handle comma separators', () => {
    const result = parseAllCatalogues('Op. 27, K. 331');
    expect(result).toHaveLength(2);
  });

  it('should return empty for empty input', () => {
    expect(parseAllCatalogues('')).toEqual([]);
  });
});

describe('parseOpus', () => {
  it('should parse simple opus', () => {
    expect(parseOpus('Op. 27')).toEqual({ opus: 27 });
  });

  it('should parse opus with number', () => {
    expect(parseOpus('Op. 27 No. 2')).toEqual({ opus: 27, number: 2 });
  });

  it('should return null for non-opus', () => {
    expect(parseOpus('BWV 1001')).toBeNull();
  });
});

describe('formatCatalogue', () => {
  it('should format opus numbers', () => {
    expect(formatCatalogue({ raw: 'Op. 27', system: 'op', number: 27 })).toBe('Op. 27');
  });

  it('should format opus with suffix', () => {
    expect(
      formatCatalogue({ raw: 'Op. 27 No. 2', system: 'op', number: 27, suffix: 'No.2' })
    ).toBe('Op. 27 No.2');
  });

  it('should format BWV', () => {
    expect(formatCatalogue({ raw: 'BWV 1001', system: 'bwv', number: 1001 })).toBe('BWV 1001');
  });

  it('should format Hob with Roman numeral', () => {
    expect(
      formatCatalogue({ raw: 'Hob. XVI:52', system: 'hob', number: 52, suffix: 'XVI' })
    ).toBe('Hob. XVI:52');
  });

  it('should return raw if no system or number', () => {
    expect(formatCatalogue({ raw: 'Unknown 123' })).toBe('Unknown 123');
  });
});

describe('getCatalogueSystemName', () => {
  it('should return full names', () => {
    expect(getCatalogueSystemName('bwv')).toBe('Bach-Werke-Verzeichnis');
    expect(getCatalogueSystemName('k')).toBe('Köchel (Mozart)');
    expect(getCatalogueSystemName('op')).toBe('Opus');
  });

  it('should return system for unknown', () => {
    expect(getCatalogueSystemName('unknown')).toBe('unknown');
  });
});

describe('compareCatalogues', () => {
  it('should sort by system first', () => {
    const a = { raw: 'BWV 1', system: 'bwv' as const, number: 1 };
    const b = { raw: 'Op. 1', system: 'op' as const, number: 1 };
    expect(compareCatalogues(a, b)).toBeLessThan(0);
  });

  it('should sort by number within same system', () => {
    const a = { raw: 'BWV 1', system: 'bwv' as const, number: 1 };
    const b = { raw: 'BWV 2', system: 'bwv' as const, number: 2 };
    expect(compareCatalogues(a, b)).toBeLessThan(0);
    expect(compareCatalogues(b, a)).toBeGreaterThan(0);
  });

  it('should sort by suffix as tiebreaker', () => {
    const a = { raw: 'BWV 1a', system: 'bwv' as const, number: 1, suffix: 'a' };
    const b = { raw: 'BWV 1b', system: 'bwv' as const, number: 1, suffix: 'b' };
    expect(compareCatalogues(a, b)).toBeLessThan(0);
  });
});
