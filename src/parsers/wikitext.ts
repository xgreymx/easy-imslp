/**
 * Wikitext template parser for IMSLP pages
 *
 * IMSLP uses MediaWiki templates to store metadata about composers and works.
 * This parser extracts template parameters from wikitext.
 */

/**
 * Parsed template with name and parameters
 */
export interface ParsedTemplate {
  /** Template name (e.g., "Composer", "Work") */
  name: string;
  /** Template parameters as key-value pairs */
  params: Record<string, string>;
  /** Positional parameters (unnamed) */
  positional: string[];
  /** Raw template string */
  raw: string;
}

/**
 * Extract all templates from wikitext
 */
export function extractTemplates(wikitext: string): ParsedTemplate[] {
  const templates: ParsedTemplate[] = [];
  let depth = 0;
  let start = -1;

  // Find template boundaries by tracking {{ and }}
  for (let i = 0; i < wikitext.length - 1; i++) {
    const char = wikitext[i];
    const next = wikitext[i + 1];

    if (char === '{' && next === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
      i++; // Skip next char
    } else if (char === '}' && next === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const templateStr = wikitext.slice(start, i + 2);
        const parsed = parseTemplate(templateStr);
        if (parsed) {
          templates.push(parsed);
        }
        start = -1;
      }
      i++; // Skip next char
    }
  }

  return templates;
}

/**
 * Parse a single template string
 */
export function parseTemplate(templateStr: string): ParsedTemplate | null {
  // Remove outer {{ }}
  const inner = templateStr.slice(2, -2).trim();
  if (!inner) return null;

  // Split by | but respect nested templates and links
  const parts = splitTemplateParts(inner);
  if (parts.length === 0) return null;

  // First part is the template name
  const name = parts[0]?.trim() ?? '';
  if (!name) return null;

  const params: Record<string, string> = {};
  const positional: string[] = [];

  // Parse remaining parts as parameters
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i] ?? '';
    const eqIndex = findUnnestedEquals(part);

    if (eqIndex !== -1) {
      // Named parameter: key=value
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      if (key) {
        params[key] = cleanValue(value);
      }
    } else {
      // Positional parameter
      positional.push(cleanValue(part.trim()));
    }
  }

  return {
    name,
    params,
    positional,
    raw: templateStr,
  };
}

/**
 * Split template content by | while respecting nesting
 */
function splitTemplateParts(content: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let linkDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    const next = content[i + 1];

    // Track nested templates
    if (char === '{' && next === '{') {
      depth++;
      current += '{{';
      i++;
      continue;
    }
    if (char === '}' && next === '}') {
      depth--;
      current += '}}';
      i++;
      continue;
    }

    // Track wiki links [[ ]]
    if (char === '[' && next === '[') {
      linkDepth++;
      current += '[[';
      i++;
      continue;
    }
    if (char === ']' && next === ']') {
      linkDepth--;
      current += ']]';
      i++;
      continue;
    }

    // Split on | only at top level
    if (char === '|' && depth === 0 && linkDepth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Find the first = that's not inside nested templates/links
 */
function findUnnestedEquals(str: string): number {
  let depth = 0;
  let linkDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    const next = str[i + 1];

    if (char === '{' && next === '{') {
      depth++;
      i++;
    } else if (char === '}' && next === '}') {
      depth--;
      i++;
    } else if (char === '[' && next === '[') {
      linkDepth++;
      i++;
    } else if (char === ']' && next === ']') {
      linkDepth--;
      i++;
    } else if (char === '=' && depth === 0 && linkDepth === 0) {
      return i;
    }
  }

  return -1;
}

/**
 * Clean a parameter value
 */
function cleanValue(value: string): string {
  return value
    .replace(/<!--.*?-->/g, '') // Remove HTML comments
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<[^>]+>/g, '') // Remove other HTML tags
    .trim();
}

/**
 * Extract a specific template by name
 */
export function findTemplate(wikitext: string, templateName: string): ParsedTemplate | null {
  const templates = extractTemplates(wikitext);
  const lowerName = templateName.toLowerCase();

  return (
    templates.find((t) => t.name.toLowerCase() === lowerName) ??
    templates.find((t) => t.name.toLowerCase().startsWith(lowerName)) ??
    null
  );
}

/**
 * Extract all templates with a given name
 */
export function findAllTemplates(wikitext: string, templateName: string): ParsedTemplate[] {
  const templates = extractTemplates(wikitext);
  const lowerName = templateName.toLowerCase();

  return templates.filter(
    (t) => t.name.toLowerCase() === lowerName || t.name.toLowerCase().startsWith(lowerName + '/')
  );
}

/**
 * Extract wiki links from text
 * Returns array of [display, target] pairs
 */
export function extractWikiLinks(text: string): Array<{ display: string; target: string }> {
  const links: Array<{ display: string; target: string }> = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const target = match[1]?.trim() ?? '';
    const display = match[2]?.trim() ?? target;
    links.push({ display, target });
  }

  return links;
}

/**
 * Remove wiki markup from text
 */
export function stripWikiMarkup(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1') // [[target|display]] -> display
    .replace(/'''([^']+)'''/g, '$1') // '''bold''' -> bold
    .replace(/''([^']+)''/g, '$1') // ''italic'' -> italic
    .replace(/{{[^}]+}}/g, '') // Remove templates
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '') // Remove references
    .replace(/<ref[^>]*\/>/gi, '') // Remove self-closing refs
    .replace(/<!--.*?-->/g, '') // Remove comments
    .trim();
}

/**
 * Parse a year from various formats
 */
export function parseYear(text: string): number | undefined {
  if (!text) return undefined;

  const trimmed = text.trim();

  // Handle century notation first (e.g., "18th century")
  const centuryMatch = trimmed.match(/(\d+)(?:st|nd|rd|th)\s*century/i);
  if (centuryMatch?.[1]) {
    const century = parseInt(centuryMatch[1], 10);
    // Return middle of century as approximation
    return (century - 1) * 100 + 50;
  }

  // Try direct parse (only if the string is purely numeric)
  if (/^\d+$/.test(trimmed)) {
    const direct = parseInt(trimmed, 10);
    if (direct > 0 && direct < 3000) {
      return direct;
    }
  }

  // Try to extract 4-digit year
  const match = trimmed.match(/\b(\d{4})\b/);
  if (match?.[1]) {
    const year = parseInt(match[1], 10);
    if (year > 0 && year < 3000) {
      return year;
    }
  }

  return undefined;
}

/**
 * Parse a year range (e.g., "1770-1827")
 */
export function parseYearRange(text: string): { start?: number; end?: number } {
  if (!text) return {};

  // Handle ranges like "1770-1827" or "1770–1827"
  const rangeMatch = text.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (rangeMatch) {
    return {
      start: parseInt(rangeMatch[1]!, 10),
      end: parseInt(rangeMatch[2]!, 10),
    };
  }

  // Handle single year
  const year = parseYear(text);
  if (year) {
    return { start: year };
  }

  return {};
}
