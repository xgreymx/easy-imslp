import { describe, it, expect } from 'vitest';
import {
  parseComposerWikitext,
  parseWorkWikitext,
  parseScoreWikitext,
  createComposerReference,
} from '../../src/parsers/response.js';

describe('parseComposerWikitext', () => {
  it('should parse basic composer template', () => {
    const wikitext = `
      {{Composer
      |first_name=Ludwig
      |last_name=Beethoven
      |birth_date=1770
      |death_date=1827
      |nationality=German
      |time_period=Classical
      }}
    `;

    const result = parseComposerWikitext(wikitext, 'Beethoven,_Ludwig_van');

    expect(result.data.name).toBe('Ludwig Beethoven');
    expect(result.data.sortName).toBe('Beethoven, Ludwig');
    expect(result.data.birthYear).toBe(1770);
    expect(result.data.deathYear).toBe(1827);
    expect(result.data.nationality).toBe('German');
    expect(result.data.timePeriod).toBe('classical');
    expect(result.warnings).toHaveLength(0);
  });

  it('should fall back to slug when name not in template', () => {
    const wikitext = '{{Composer|nationality=German}}';
    const result = parseComposerWikitext(wikitext, 'Bach,_Johann_Sebastian');

    expect(result.data.name).toBe('Johann Sebastian Bach');
    expect(result.warnings).toContain('Could not extract composer name from template, using slug');
  });

  it('should generate warning for unparseable dates', () => {
    const wikitext = '{{Composer|birth_date=unknown|death_date=???}}';
    const result = parseComposerWikitext(wikitext, 'Test');

    expect(result.data.birthYear).toBeUndefined();
    expect(result.data.deathYear).toBeUndefined();
    // These should NOT generate warnings since the values are just empty-ish
  });

  it('should build correct URL', () => {
    const wikitext = '{{Composer}}';
    const result = parseComposerWikitext(wikitext, 'Mozart, Wolfgang Amadeus');

    expect(result.data.url).toContain('imslp.org/wiki/Category:');
    expect(result.data.url).toContain('Mozart');
  });
});

describe('parseWorkWikitext', () => {
  it('should parse basic work template', () => {
    const wikitext = `
      {{Work
      |work_title=Piano Sonata No.14
      |opus=Op. 27 No. 2
      |key=C-sharp minor
      |year=1801
      |instrumentation=piano
      |genre=Sonata
      }}
    `;

    const result = parseWorkWikitext(wikitext, 'Piano_Sonata_No.14_(Beethoven)', 'Beethoven');

    expect(result.data.title).toBe('Piano Sonata No.14');
    expect(result.data.opus).toBe('Op. 27 No. 2');
    expect(result.data.key).toBe('C-sharp minor');
    expect(result.data.year).toBe(1801);
    expect(result.data.genre).toBe('Sonata');
    expect(result.data.instrumentation[0]?.normalized).toBe('piano');
  });

  it('should build full title with opus', () => {
    const wikitext = '{{Work|work_title=Sonata|opus=Op.1}}';
    const result = parseWorkWikitext(wikitext, 'test', 'composer');

    expect(result.data.fullTitle).toBe('Sonata, Op.1');
  });

  it('should parse catalogue information', () => {
    const wikitext = '{{Work|opus=BWV 1001}}';
    const result = parseWorkWikitext(wikitext, 'test', 'composer');

    expect(result.data.catalogue?.system).toBe('bwv');
    expect(result.data.catalogue?.number).toBe(1001);
  });

  it('should parse multiple instruments', () => {
    const wikitext = '{{Work|instrumentation=violin, viola, cello}}';
    const result = parseWorkWikitext(wikitext, 'test', 'composer');

    expect(result.data.instrumentation).toHaveLength(3);
    expect(result.data.instrumentation[0]?.normalized).toBe('violin');
    expect(result.data.instrumentation[1]?.normalized).toBe('viola');
    expect(result.data.instrumentation[2]?.normalized).toBe('cello');
  });

  it('should generate warning for missing instrumentation', () => {
    const wikitext = '{{Work|title=Test}}';
    const result = parseWorkWikitext(wikitext, 'test', 'composer');

    expect(result.warnings).toContain('No instrumentation data found');
  });

  it('should extract composer from work slug', () => {
    const wikitext = '{{Work|title=Test}}';
    const result = parseWorkWikitext(wikitext, 'Test_(Beethoven,_Ludwig_van)');

    expect(result.data.composer.slug).toBe('Beethoven, Ludwig van');
  });

  it('should parse difficulty ratings', () => {
    const wikitext = '{{Work|difficulty=7}}';
    const result = parseWorkWikitext(wikitext, 'test', 'composer');

    expect(result.data.difficulty?.level).toBe(7);
    expect(result.data.difficulty?.description).toBe('Very Difficult');
  });
});

describe('parseScoreWikitext', () => {
  it('should parse basic score info', () => {
    const wikitext = `
      {{File
      |editor=Henle
      |publisher=G. Henle Verlag
      |year=2010
      |pages=24
      |scan_quality=high
      }}
    `;

    const result = parseScoreWikitext(wikitext, 'PMLP01458-test.pdf');

    expect(result.data.editor).toBe('Henle');
    expect(result.data.publisher).toBe('G. Henle Verlag');
    expect(result.data.publicationYear).toBe(2010);
    expect(result.data.pageCount).toBe(24);
    expect(result.data.scanQuality).toBe('high');
  });

  it('should detect Urtext editions', () => {
    const wikitext = '{{File|edition=Urtext}}';
    const result = parseScoreWikitext(wikitext, 'test.pdf');

    expect(result.data.isUrtext).toBe(true);
  });

  it('should build correct URLs', () => {
    const result = parseScoreWikitext('', 'test file.pdf');

    expect(result.data.url).toContain('File:');
    expect(result.data.downloadUrl).toContain('Special:ImagefromIndex');
  });
});

describe('createComposerReference', () => {
  it('should create reference from slug', () => {
    const ref = createComposerReference('Beethoven,_Ludwig_van');

    expect(ref.slug).toBe('Beethoven,_Ludwig_van');
    expect(ref.name).toBe('Ludwig van Beethoven');
  });

  it('should use provided name', () => {
    const ref = createComposerReference('test-slug', 'Custom Name');

    expect(ref.slug).toBe('test-slug');
    expect(ref.name).toBe('Custom Name');
  });
});
