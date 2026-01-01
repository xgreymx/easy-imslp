/**
 * Score service for IMSLP
 *
 * Provides operations for fetching and managing score files.
 */

import { MediaWikiApi } from '../api/mediawiki-api.js';
import { buildDownloadUrl, buildDirectDownloadUrl } from '../api/legacy-api.js';
import type { ParseResult } from '../client/types.js';
import type { Score, ScoreWithMethods } from '../models/score.js';
import type { ValidationResult, ValidationIssue } from '../models/work.js';
import { parseScoreWikitext } from '../parsers/response.js';
import { extractTemplates } from '../parsers/wikitext.js';
import { NotFoundError } from '../errors/errors.js';

/**
 * Score service
 */
export class ScoreService {
  private readonly api: MediaWikiApi;

  constructor(api: MediaWikiApi) {
    this.api = api;
  }

  /**
   * Get all scores for a work
   *
   * @param workSlug - Work slug like "Piano_Sonata_No.14_(Beethoven,_Ludwig_van)"
   */
  async getWorkScores(workSlug: string): Promise<ParseResult<ScoreWithMethods[]>> {
    const normalizedSlug = this.normalizeSlug(workSlug);
    const allWarnings: string[] = [];
    const scores: ScoreWithMethods[] = [];

    try {
      const wikitext = await this.api.getPageWikitext(normalizedSlug);

      if (!wikitext) {
        throw new NotFoundError(`Work not found: ${workSlug}`, {
          url: `https://imslp.org/wiki/${normalizedSlug}`,
          suggestion: 'Check the work slug format.',
        });
      }

      // Extract all file-related templates from the wikitext
      const templates = extractTemplates(wikitext);
      const fileTemplates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes('file') ||
          t.name.toLowerCase().includes('score') ||
          t.name.toLowerCase().includes('#fte') ||
          t.name.toLowerCase().includes('#sfe')
      );

      // Also look for PMLP (Petrucci Music Library Project) file references
      const pmlpMatches = wikitext.matchAll(/PMLP\d+[-_][^|\s}]+\.pdf/gi);
      const pmlpFiles = [...pmlpMatches].map((m) => m[0]);

      // Parse file templates
      for (const template of fileTemplates) {
        const filename = template.params['filename'] ?? template.params['name'] ?? '';
        if (filename) {
          const parsed = parseScoreWikitext(template.raw, filename);
          scores.push(this.addMethods(parsed.data));
          allWarnings.push(...parsed.warnings);
        }
      }

      // Parse PMLP file references
      for (const filename of pmlpFiles) {
        // Avoid duplicates
        if (scores.some((s) => s.filename === filename)) continue;

        const parsed = parseScoreWikitext('', filename);
        scores.push(this.addMethods(parsed.data));
        allWarnings.push(...parsed.warnings);
      }

      // If we couldn't find any scores, try getting category members
      if (scores.length === 0) {
        const filesFromCategory = await this.getScoresFromCategory(normalizedSlug);
        scores.push(...filesFromCategory.data);
        allWarnings.push(...filesFromCategory.warnings);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      allWarnings.push(`Error fetching scores for work: ${workSlug}`);
    }

    return { data: scores, warnings: allWarnings };
  }

  /**
   * Get scores from a work's category
   */
  private async getScoresFromCategory(
    workSlug: string
  ): Promise<ParseResult<ScoreWithMethods[]>> {
    const allWarnings: string[] = [];
    const scores: ScoreWithMethods[] = [];

    try {
      const result = await this.api.getCategoryMembers(workSlug, {
        namespace: 6, // File namespace
        limit: 100,
      });

      for (const member of result.members) {
        const filename = member.title.replace('File:', '');

        // Only include PDF files
        if (!filename.toLowerCase().endsWith('.pdf')) continue;

        try {
          const imageInfo = await this.api.getImageInfo(filename);
          const score = this.createScoreFromImageInfo(filename, imageInfo);
          scores.push(this.addMethods(score));
        } catch {
          // Fall back to minimal score info
          const parsed = parseScoreWikitext('', filename);
          scores.push(this.addMethods(parsed.data));
        }
      }
    } catch {
      allWarnings.push(`Could not fetch scores from category`);
    }

    return { data: scores, warnings: allWarnings };
  }

  /**
   * Get a single score by filename
   *
   * @param filename - Score filename like "PMLP01458-Beethoven_-_Piano_Sonata_No._14.pdf"
   */
  async getScore(filename: string): Promise<ParseResult<ScoreWithMethods>> {
    try {
      const imageInfo = await this.api.getImageInfo(filename);

      if (!imageInfo) {
        throw new NotFoundError(`Score not found: ${filename}`, {
          url: `https://imslp.org/wiki/File:${encodeURIComponent(filename)}`,
          suggestion: 'Check the filename. IMSLP filenames usually start with PMLP.',
        });
      }

      const score = this.createScoreFromImageInfo(filename, imageInfo);

      return {
        data: this.addMethods(score),
        warnings: [],
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new NotFoundError(`Score not found: ${filename}`, {
        url: `https://imslp.org/wiki/File:${encodeURIComponent(filename)}`,
        suggestion: 'Check the filename. IMSLP filenames usually start with PMLP.',
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get download URL for a score
   *
   * @param filename - Score filename
   */
  getScoreDownloadUrl(filename: string): string {
    return buildDownloadUrl(filename);
  }

  /**
   * Get direct download URL (skips IMSLP disclaimer page)
   *
   * @param filename - Score filename
   */
  getDirectDownloadUrl(filename: string): string {
    return buildDirectDownloadUrl(filename);
  }

  /**
   * Validate a score's data
   */
  validateScore(score: Score): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Required fields
    if (!score.filename) {
      issues.push({
        field: 'filename',
        message: 'Score filename is missing',
        severity: 'error',
      });
    }

    if (!score.url) {
      issues.push({
        field: 'url',
        message: 'Score URL is missing',
        severity: 'error',
      });
    }

    // Recommended fields
    if (!score.editor && !score.publisher) {
      issues.push({
        field: 'editor',
        message: 'No editor or publisher information available',
        severity: 'warning',
      });
    }

    if (!score.pageCount) {
      issues.push({
        field: 'pageCount',
        message: 'Page count is missing',
        severity: 'warning',
      });
    }

    // Data quality checks
    if (score.publicationYear) {
      if (score.publicationYear < 1400 || score.publicationYear > new Date().getFullYear()) {
        issues.push({
          field: 'publicationYear',
          message: `Publication year ${score.publicationYear} seems invalid`,
          severity: 'warning',
        });
      }
    }

    if (score.pageCount && score.pageCount <= 0) {
      issues.push({
        field: 'pageCount',
        message: `Page count ${score.pageCount} is invalid`,
        severity: 'warning',
      });
    }

    return {
      valid: !issues.some((i) => i.severity === 'error'),
      issues,
    };
  }

  /**
   * Add methods to a Score object
   */
  private addMethods(score: Score): ScoreWithMethods {
    const service = this;

    return {
      ...score,
      validate() {
        return service.validateScore(this);
      },
    };
  }

  /**
   * Create a score from MediaWiki image info
   */
  private createScoreFromImageInfo(
    filename: string,
    imageInfo: Awaited<ReturnType<MediaWikiApi['getImageInfo']>>
  ): Score {
    const info = imageInfo?.imageinfo?.[0];

    return {
      id: filename,
      filename,
      url: `https://imslp.org/wiki/File:${encodeURIComponent(filename)}`,
      downloadUrl: this.getScoreDownloadUrl(filename),
      fileSize: info?.size,
    };
  }

  /**
   * Normalize a work slug
   */
  private normalizeSlug(slug: string): string {
    return slug.replace(/ /g, '_');
  }
}
