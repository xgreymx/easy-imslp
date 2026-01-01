import { describe, it, expect } from 'vitest';
import {
  formatComposerName,
  formatWorkTitle,
  formatYearRange,
  formatLifespan,
  formatInstrumentation,
  groupByInstrument,
  groupByGenre,
  groupByComposer,
  slugify,
  unslugify,
  truncate,
  capitalize,
  titleCase,
} from '../../src/utils/format.js';
import type { Work } from '../../src/models/work.js';

describe('formatComposerName', () => {
  it('should format full name from slug', () => {
    expect(formatComposerName('Beethoven,_Ludwig_van', 'full')).toBe('Ludwig van Beethoven');
    expect(formatComposerName('Mozart,_Wolfgang_Amadeus', 'full')).toBe('Wolfgang Amadeus Mozart');
    expect(formatComposerName('Bach,_Johann_Sebastian', 'full')).toBe('Johann Sebastian Bach');
  });

  it('should format short name (last name only)', () => {
    expect(formatComposerName('Beethoven,_Ludwig_van', 'short')).toBe('Beethoven');
    expect(formatComposerName('Mozart,_Wolfgang_Amadeus', 'short')).toBe('Mozart');
  });

  it('should format sort name', () => {
    expect(formatComposerName('Beethoven,_Ludwig_van', 'sort')).toBe('Beethoven, Ludwig van');
    expect(formatComposerName('Mozart,_Wolfgang_Amadeus', 'sort')).toBe('Mozart, Wolfgang Amadeus');
  });

  it('should default to full name', () => {
    expect(formatComposerName('Beethoven,_Ludwig_van')).toBe('Ludwig van Beethoven');
  });

  it('should handle names without comma', () => {
    expect(formatComposerName('Anonymous')).toBe('Anonymous');
    expect(formatComposerName('Traditional')).toBe('Traditional');
  });

  it('should handle empty input', () => {
    expect(formatComposerName('')).toBe('');
  });

  it('should replace underscores with spaces', () => {
    expect(formatComposerName('Beethoven,_Ludwig_van', 'full')).toBe('Ludwig van Beethoven');
  });
});

describe('formatWorkTitle', () => {
  it('should combine title and opus', () => {
    expect(formatWorkTitle('Piano Sonata No.14', 'Op. 27 No. 2')).toBe('Piano Sonata No.14, Op. 27 No. 2');
  });

  it('should return title alone if no opus', () => {
    expect(formatWorkTitle('Symphony No.5')).toBe('Symphony No.5');
    expect(formatWorkTitle('Prelude', undefined)).toBe('Prelude');
  });

  it('should handle empty title', () => {
    expect(formatWorkTitle('')).toBe('');
  });
});

describe('formatYearRange', () => {
  it('should format complete range', () => {
    expect(formatYearRange(1770, 1827)).toBe('1770–1827');
  });

  it('should format start year only', () => {
    expect(formatYearRange(1770)).toBe('1770–');
  });

  it('should format end year only', () => {
    expect(formatYearRange(undefined, 1827)).toBe('–1827');
  });

  it('should handle same year', () => {
    expect(formatYearRange(1800, 1800)).toBe('1800');
  });

  it('should handle no years', () => {
    expect(formatYearRange()).toBe('');
  });
});

describe('formatLifespan', () => {
  it('should format complete lifespan', () => {
    expect(formatLifespan(1770, 1827)).toBe('1770–1827');
  });

  it('should format birth year only', () => {
    expect(formatLifespan(1970)).toBe('b. 1970');
  });

  it('should format death year only', () => {
    expect(formatLifespan(undefined, 1827)).toBe('d. 1827');
  });

  it('should handle no years', () => {
    expect(formatLifespan()).toBe('');
  });
});

describe('formatInstrumentation', () => {
  it('should join normalized instruments', () => {
    const instruments = [
      { raw: 'vln', normalized: 'violin' as const },
      { raw: 'pf', normalized: 'piano' as const },
    ];
    expect(formatInstrumentation(instruments)).toBe('violin, piano');
  });

  it('should use raw values when requested', () => {
    const instruments = [
      { raw: 'vln', normalized: 'violin' as const },
      { raw: 'pf', normalized: 'piano' as const },
    ];
    expect(formatInstrumentation(instruments, true)).toBe('vln, pf');
  });

  it('should handle empty array', () => {
    expect(formatInstrumentation([])).toBe('');
  });
});

describe('groupByInstrument', () => {
  it('should group works by primary instrument', () => {
    const works: Work[] = [
      createMockWork('Work1', [{ raw: 'piano', normalized: 'piano' }]),
      createMockWork('Work2', [{ raw: 'violin', normalized: 'violin' }]),
      createMockWork('Work3', [{ raw: 'piano', normalized: 'piano' }]),
    ];

    const grouped = groupByInstrument(works);

    expect(grouped['piano']).toHaveLength(2);
    expect(grouped['violin']).toHaveLength(1);
  });

  it('should use "unknown" for works without instrumentation', () => {
    const works: Work[] = [
      createMockWork('Work1', []),
    ];

    const grouped = groupByInstrument(works);

    expect(grouped['unknown']).toHaveLength(1);
  });
});

describe('groupByGenre', () => {
  it('should group works by genre', () => {
    const works: Work[] = [
      { ...createMockWork('Work1', []), genre: 'Sonata' },
      { ...createMockWork('Work2', []), genre: 'Symphony' },
      { ...createMockWork('Work3', []), genre: 'Sonata' },
    ];

    const grouped = groupByGenre(works);

    expect(grouped['Sonata']).toHaveLength(2);
    expect(grouped['Symphony']).toHaveLength(1);
  });

  it('should use "unknown" for works without genre', () => {
    const works: Work[] = [
      createMockWork('Work1', []),
    ];

    const grouped = groupByGenre(works);

    expect(grouped['unknown']).toHaveLength(1);
  });
});

describe('groupByComposer', () => {
  it('should group works by composer slug', () => {
    const works: Work[] = [
      createMockWork('Work1', [], 'Beethoven'),
      createMockWork('Work2', [], 'Mozart'),
      createMockWork('Work3', [], 'Beethoven'),
    ];

    const grouped = groupByComposer(works);

    expect(grouped['Beethoven']).toHaveLength(2);
    expect(grouped['Mozart']).toHaveLength(1);
  });
});

describe('slugify', () => {
  it('should replace spaces with underscores', () => {
    expect(slugify('Hello World')).toBe('Hello_World');
  });

  it('should remove special characters', () => {
    expect(slugify('Hello! World?')).toBe('Hello_World');
  });

  it('should keep allowed characters', () => {
    expect(slugify('Test_Work-1.0()')).toBe('Test_Work-1.0()');
  });

  it('should trim whitespace', () => {
    expect(slugify('  Hello World  ')).toBe('Hello_World');
  });
});

describe('unslugify', () => {
  it('should replace underscores with spaces', () => {
    expect(unslugify('Hello_World')).toBe('Hello World');
  });

  it('should trim whitespace', () => {
    expect(unslugify('  Hello_World  ')).toBe('Hello World');
  });
});

describe('truncate', () => {
  it('should truncate long text', () => {
    expect(truncate('This is a very long text', 10)).toBe('This is...');
  });

  it('should not truncate short text', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('should handle exact length', () => {
    expect(truncate('Exact', 5)).toBe('Exact');
  });

  it('should handle empty input', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should handle already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('should only affect first letter', () => {
    expect(capitalize('hELLO wORLD')).toBe('HELLO wORLD');
  });
});

describe('titleCase', () => {
  it('should capitalize each word', () => {
    expect(titleCase('hello world')).toBe('Hello World');
  });

  it('should handle mixed case', () => {
    expect(titleCase('hELLO wORLD')).toBe('Hello World');
  });

  it('should handle empty string', () => {
    expect(titleCase('')).toBe('');
  });

  it('should handle single word', () => {
    expect(titleCase('hello')).toBe('Hello');
  });
});

// Helper function to create mock works
function createMockWork(
  title: string,
  instrumentation: Array<{ raw: string; normalized: string }>,
  composerSlug = 'Composer'
): Work {
  return {
    slug: title.replace(/ /g, '_'),
    title,
    fullTitle: title,
    url: `https://imslp.org/wiki/${title}`,
    composer: { slug: composerSlug, name: composerSlug },
    instrumentation,
  };
}
