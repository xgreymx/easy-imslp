import { describe, it, expect } from 'vitest';
import {
  extractTemplates,
  parseTemplate,
  findTemplate,
  extractWikiLinks,
  stripWikiMarkup,
  parseYear,
  parseYearRange,
} from '../../src/parsers/wikitext.js';

describe('extractTemplates', () => {
  it('should extract a single template', () => {
    const wikitext = '{{Composer|first_name=Ludwig|last_name=Beethoven}}';
    const templates = extractTemplates(wikitext);

    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe('Composer');
    expect(templates[0]?.params).toEqual({
      first_name: 'Ludwig',
      last_name: 'Beethoven',
    });
  });

  it('should extract multiple templates', () => {
    const wikitext = `
      {{Composer|name=Bach}}
      Some text here
      {{Work|title=Test}}
    `;
    const templates = extractTemplates(wikitext);

    expect(templates).toHaveLength(2);
    expect(templates[0]?.name).toBe('Composer');
    expect(templates[1]?.name).toBe('Work');
  });

  it('should handle nested templates', () => {
    const wikitext = '{{Outer|param={{Inner|value=test}}}}';
    const templates = extractTemplates(wikitext);

    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe('Outer');
    expect(templates[0]?.params['param']).toBe('{{Inner|value=test}}');
  });

  it('should handle empty templates', () => {
    const wikitext = '{{EmptyTemplate}}';
    const templates = extractTemplates(wikitext);

    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe('EmptyTemplate');
    expect(templates[0]?.params).toEqual({});
  });
});

describe('parseTemplate', () => {
  it('should parse named parameters', () => {
    const result = parseTemplate('{{Test|key1=value1|key2=value2}}');

    expect(result?.name).toBe('Test');
    expect(result?.params).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('should parse positional parameters', () => {
    const result = parseTemplate('{{Test|first|second|third}}');

    expect(result?.name).toBe('Test');
    expect(result?.positional).toEqual(['first', 'second', 'third']);
  });

  it('should parse mixed parameters', () => {
    const result = parseTemplate('{{Test|positional|named=value}}');

    expect(result?.positional).toEqual(['positional']);
    expect(result?.params).toEqual({ named: 'value' });
  });

  it('should handle wiki links in parameters', () => {
    const result = parseTemplate('{{Test|link=[[Page|Display]]}}');

    expect(result?.params['link']).toBe('[[Page|Display]]');
  });

  it('should return null for empty template', () => {
    expect(parseTemplate('{{}}')).toBeNull();
  });

  it('should strip HTML comments from values', () => {
    const result = parseTemplate('{{Test|key=value<!-- comment -->}}');
    expect(result?.params['key']).toBe('value');
  });
});

describe('findTemplate', () => {
  it('should find a specific template', () => {
    const wikitext = '{{Composer|name=Bach}}{{Work|title=Test}}';
    const template = findTemplate(wikitext, 'Work');

    expect(template?.name).toBe('Work');
    expect(template?.params['title']).toBe('Test');
  });

  it('should be case-insensitive', () => {
    const wikitext = '{{COMPOSER|name=Bach}}';
    const template = findTemplate(wikitext, 'composer');

    expect(template?.name).toBe('COMPOSER');
  });

  it('should return null if not found', () => {
    const wikitext = '{{Composer|name=Bach}}';
    const template = findTemplate(wikitext, 'Work');

    expect(template).toBeNull();
  });
});

describe('extractWikiLinks', () => {
  it('should extract simple links', () => {
    const text = 'See [[Target Page]] for more';
    const links = extractWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ display: 'Target Page', target: 'Target Page' });
  });

  it('should extract links with display text', () => {
    const text = 'See [[Target|Display Text]] for more';
    const links = extractWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ display: 'Display Text', target: 'Target' });
  });

  it('should extract multiple links', () => {
    const text = '[[Link1]] and [[Link2|Text]]';
    const links = extractWikiLinks(text);

    expect(links).toHaveLength(2);
  });
});

describe('stripWikiMarkup', () => {
  it('should strip wiki links', () => {
    expect(stripWikiMarkup('[[Target|Display]]')).toBe('Display');
    expect(stripWikiMarkup('[[Simple Link]]')).toBe('Simple Link');
  });

  it('should strip bold and italic', () => {
    expect(stripWikiMarkup("'''bold'''")).toBe('bold');
    expect(stripWikiMarkup("''italic''")).toBe('italic');
  });

  it('should strip templates', () => {
    expect(stripWikiMarkup('text {{template}} more')).toBe('text  more');
  });

  it('should strip references', () => {
    expect(stripWikiMarkup('text<ref>citation</ref>more')).toBe('textmore');
    expect(stripWikiMarkup('text<ref name="x"/>more')).toBe('textmore');
  });
});

describe('parseYear', () => {
  it('should parse 4-digit years', () => {
    expect(parseYear('1770')).toBe(1770);
    expect(parseYear('2023')).toBe(2023);
  });

  it('should extract year from text', () => {
    expect(parseYear('Born in 1770')).toBe(1770);
    expect(parseYear('December 16, 1770')).toBe(1770);
  });

  it('should handle century notation', () => {
    expect(parseYear('18th century')).toBe(1750);
    expect(parseYear('19th century')).toBe(1850);
  });

  it('should return undefined for invalid input', () => {
    expect(parseYear('')).toBeUndefined();
    expect(parseYear('unknown')).toBeUndefined();
    expect(parseYear('abc')).toBeUndefined();
  });
});

describe('parseYearRange', () => {
  it('should parse year ranges', () => {
    expect(parseYearRange('1770-1827')).toEqual({ start: 1770, end: 1827 });
    expect(parseYearRange('1770–1827')).toEqual({ start: 1770, end: 1827 }); // en-dash
  });

  it('should parse single years', () => {
    expect(parseYearRange('1770')).toEqual({ start: 1770 });
  });

  it('should return empty for invalid input', () => {
    expect(parseYearRange('')).toEqual({});
    expect(parseYearRange('unknown')).toEqual({});
  });
});
