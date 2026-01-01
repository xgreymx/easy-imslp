import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreService } from '../../../src/services/score.js';
import { MediaWikiApi } from '../../../src/api/mediawiki-api.js';
import { NotFoundError } from '../../../src/errors/errors.js';
import type { HttpClient } from '../../../src/client/http.js';
import type { Score } from '../../../src/models/score.js';

// Mock MediaWikiApi
vi.mock('../../../src/api/mediawiki-api.js');

describe('ScoreService', () => {
  let service: ScoreService;
  let mockApi: MediaWikiApi;

  beforeEach(() => {
    const mockHttp = {} as HttpClient;
    mockApi = new MediaWikiApi(mockHttp);
    service = new ScoreService(mockApi);
    vi.clearAllMocks();
  });

  describe('getWorkScores', () => {
    it('should get scores from work wikitext', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        Some text
        {{File|filename=PMLP01458-test.pdf|editor=Henle|pages=24}}
        {{File|filename=PMLP01458-test2.pdf|publisher=Peters}}
      `);

      const result = await service.getWorkScores('Test_Work');

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.filename).toBe('PMLP01458-test.pdf');
      expect(result.data[0]?.editor).toBe('Henle');
      expect(result.data[1]?.filename).toBe('PMLP01458-test2.pdf');
    });

    it('should extract PMLP file references', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        Download: PMLP01458-Beethoven_Sonata.pdf
        Also: PMLP01458-Beethoven_Sonata_v2.pdf
      `);

      const result = await service.getWorkScores('Test_Work');

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.some(s => s.filename === 'PMLP01458-Beethoven_Sonata.pdf')).toBe(true);
    });

    it('should avoid duplicate files', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        {{File|filename=PMLP01458-test.pdf}}
        Also referenced: PMLP01458-test.pdf
      `);

      const result = await service.getWorkScores('Test_Work');

      expect(result.data).toHaveLength(1);
    });

    it('should throw NotFoundError for missing work', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('');

      await expect(service.getWorkScores('Nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should fall back to category members when no scores found', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|title=Test}}');
      vi.mocked(mockApi.getCategoryMembers).mockResolvedValue({
        members: [
          { pageid: 1, title: 'File:PMLP01458-test.pdf' },
        ],
      });
      vi.mocked(mockApi.getImageInfo).mockResolvedValue({
        pageid: 1,
        title: 'File:PMLP01458-test.pdf',
        imageinfo: [{ size: 1000, timestamp: '2020-01-01', url: 'http://test', mime: 'application/pdf' }],
      });

      const result = await service.getWorkScores('Test_Work');

      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return scores with validate method', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{File|filename=test.pdf}}');

      const result = await service.getWorkScores('Test');

      expect(typeof result.data[0]?.validate).toBe('function');
    });
  });

  describe('getScore', () => {
    it('should get score by filename', async () => {
      vi.mocked(mockApi.getImageInfo).mockResolvedValue({
        pageid: 1,
        title: 'File:test.pdf',
        imageinfo: [{ size: 1000, timestamp: '2020-01-01', url: 'http://test', mime: 'application/pdf' }],
      });

      const result = await service.getScore('test.pdf');

      expect(result.data.filename).toBe('test.pdf');
      expect(result.data.fileSize).toBe(1000);
    });

    it('should throw NotFoundError for missing file', async () => {
      vi.mocked(mockApi.getImageInfo).mockResolvedValue(null);

      await expect(service.getScore('nonexistent.pdf')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getScoreDownloadUrl', () => {
    it('should return download URL', () => {
      const url = service.getScoreDownloadUrl('PMLP01458-test.pdf');

      expect(url).toContain('Special:ImagefromIndex');
      expect(url).toContain('PMLP01458-test.pdf');
    });
  });

  describe('getDirectDownloadUrl', () => {
    it('should return direct download URL', () => {
      const url = service.getDirectDownloadUrl('PMLP01458-test.pdf');

      expect(url).toContain('images');
      expect(url).toContain('PMLP01458-test.pdf');
    });
  });

  describe('validateScore', () => {
    it('should return valid for complete score', () => {
      const score: Score = {
        id: 'test',
        filename: 'test.pdf',
        url: 'https://imslp.org/wiki/File:test.pdf',
        downloadUrl: 'https://imslp.org/wiki/Special:ImagefromIndex/test.pdf',
        editor: 'Henle',
        publisher: 'G. Henle Verlag',
        pageCount: 24,
        publicationYear: 2010,
      };

      const result = service.validateScore(score);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report error for missing filename', () => {
      const score: Score = {
        id: 'test',
        filename: '',
        url: 'https://imslp.org/wiki/File:test.pdf',
        downloadUrl: 'https://imslp.org/wiki/Special:ImagefromIndex/test.pdf',
      };

      const result = service.validateScore(score);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'filename' && i.severity === 'error')).toBe(true);
    });

    it('should report warning for missing editor/publisher', () => {
      const score: Score = {
        id: 'test',
        filename: 'test.pdf',
        url: 'https://imslp.org/wiki/File:test.pdf',
        downloadUrl: 'https://imslp.org/wiki/Special:ImagefromIndex/test.pdf',
      };

      const result = service.validateScore(score);

      expect(result.valid).toBe(true);
      expect(result.issues.some(i => i.field === 'editor' && i.severity === 'warning')).toBe(true);
    });

    it('should report warning for invalid publication year', () => {
      const score: Score = {
        id: 'test',
        filename: 'test.pdf',
        url: 'https://imslp.org/wiki/File:test.pdf',
        downloadUrl: 'https://imslp.org/wiki/Special:ImagefromIndex/test.pdf',
        publicationYear: 1200, // Too old for printed music
      };

      const result = service.validateScore(score);

      expect(result.issues.some(i => i.field === 'publicationYear' && i.message.includes('invalid'))).toBe(true);
    });

    it('should report warning for invalid page count', () => {
      const score: Score = {
        id: 'test',
        filename: 'test.pdf',
        url: 'https://imslp.org/wiki/File:test.pdf',
        downloadUrl: 'https://imslp.org/wiki/Special:ImagefromIndex/test.pdf',
        pageCount: -5,
      };

      const result = service.validateScore(score);

      expect(result.issues.some(i => i.field === 'pageCount' && i.message.includes('invalid'))).toBe(true);
    });
  });

  describe('score.validate() method', () => {
    it('should work when called on returned score', async () => {
      vi.mocked(mockApi.getImageInfo).mockResolvedValue({
        pageid: 1,
        title: 'File:test.pdf',
        imageinfo: [{ size: 1000, timestamp: '2020-01-01', url: 'http://test', mime: 'application/pdf' }],
      });

      const result = await service.getScore('test.pdf');
      const validation = result.data.validate();

      expect(validation.valid).toBe(true);
    });
  });
});
