import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegacyApi } from '../../src/api/legacy-api.js';
import { HttpClient } from '../../src/client/http.js';

describe('LegacyApi', () => {
  let api: LegacyApi;
  let mockHttp: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
    };
    api = new LegacyApi(mockHttp as unknown as HttpClient);
  });

  describe('buildDownloadUrl', () => {
    it('should build correct download URL', () => {
      const url = api.buildDownloadUrl('PMLP01458-Beethoven_Piano_Sonata_14.pdf');

      expect(url).toBe(
        'https://imslp.org/wiki/Special:ImagefromIndex/PMLP01458-Beethoven_Piano_Sonata_14.pdf'
      );
    });

    it('should encode special characters', () => {
      const url = api.buildDownloadUrl('File with spaces & symbols.pdf');

      expect(url).toContain(encodeURIComponent('File with spaces & symbols.pdf'));
    });
  });

  describe('buildDirectFileUrl', () => {
    it('should build direct file URL with hash path', () => {
      const url = api.buildDirectFileUrl('PMLP01458-Test.pdf');

      expect(url).toMatch(/^https:\/\/imslp\.org\/images\/[a-z]\/[a-z]{2}\//);
      expect(url).toContain('PMLP01458-Test.pdf');
    });
  });

  describe('getFileInfo', () => {
    it('should return file info', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '123': {
                pageid: 123,
                title: 'File:Test.pdf',
                imageinfo: [
                  {
                    timestamp: '2024-01-01T00:00:00Z',
                    size: 2048,
                    url: 'https://imslp.org/images/test.pdf',
                    mime: 'application/pdf',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await api.getFileInfo('Test.pdf');

      expect(result).not.toBeNull();
      expect(result?.filename).toBe('Test.pdf');
      expect(result?.size).toBe(2048);
      expect(result?.mimeType).toBe('application/pdf');
      expect(result?.downloadUrl).toContain('Test.pdf');
    });

    it('should return null for missing files', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '-1': {
                title: 'File:Missing.pdf',
                missing: true,
              },
            },
          },
        },
      });

      const result = await api.getFileInfo('Missing.pdf');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockHttp.get.mockRejectedValue(new Error('Network error'));

      const result = await api.getFileInfo('Error.pdf');

      expect(result).toBeNull();
    });
  });

  describe('getMultipleFileInfo', () => {
    it('should return info for multiple files', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '1': {
                title: 'File:File1.pdf',
                imageinfo: [{ timestamp: '2024-01-01', size: 100, mime: 'application/pdf' }],
              },
              '2': {
                title: 'File:File2.pdf',
                imageinfo: [{ timestamp: '2024-01-02', size: 200, mime: 'application/pdf' }],
              },
            },
          },
        },
      });

      const result = await api.getMultipleFileInfo(['File1.pdf', 'File2.pdf']);

      expect(result.size).toBe(2);
      expect(result.get('File1.pdf')?.size).toBe(100);
      expect(result.get('File2.pdf')?.size).toBe(200);
    });

    it('should handle missing files in batch', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '1': {
                title: 'File:Exists.pdf',
                imageinfo: [{ timestamp: '2024-01-01', size: 100, mime: 'application/pdf' }],
              },
              '-1': {
                title: 'File:Missing.pdf',
                missing: true,
              },
            },
          },
        },
      });

      const result = await api.getMultipleFileInfo(['Exists.pdf', 'Missing.pdf']);

      expect(result.size).toBe(1);
      expect(result.has('Exists.pdf')).toBe(true);
      expect(result.has('Missing.pdf')).toBe(false);
    });
  });

  describe('getGenreTags', () => {
    it('should return common genre tags', async () => {
      const tags = await api.getGenreTags();

      expect(tags.length).toBeGreaterThan(0);
      expect(tags.some((t) => t.name === 'Sonatas')).toBe(true);
      expect(tags.some((t) => t.name === 'Symphonies')).toBe(true);
      expect(tags.some((t) => t.name === 'Concertos')).toBe(true);
    });

    it('should return tags with id and name', async () => {
      const tags = await api.getGenreTags();

      for (const tag of tags) {
        expect(tag.id).toBeDefined();
        expect(tag.name).toBeDefined();
      }
    });
  });

  describe('buildPageUrl', () => {
    it('should build correct page URL', () => {
      const url = api.buildPageUrl('Piano Sonata No.14 (Beethoven, Ludwig van)');

      expect(url).toBe(
        'https://imslp.org/wiki/Piano_Sonata_No.14_(Beethoven%2C_Ludwig_van)'
      );
    });

    it('should handle underscores', () => {
      const url = api.buildPageUrl('Already_Has_Underscores');

      expect(url).toBe('https://imslp.org/wiki/Already_Has_Underscores');
    });
  });

  describe('buildComposerUrl', () => {
    it('should build correct composer category URL', () => {
      const url = api.buildComposerUrl('Bach, Johann Sebastian');

      expect(url).toBe(
        'https://imslp.org/wiki/Category:Bach%2C_Johann_Sebastian'
      );
    });
  });

  describe('extractSlugFromUrl', () => {
    it('should extract slug from work URL', () => {
      const slug = api.extractSlugFromUrl(
        'https://imslp.org/wiki/Piano_Sonata_No.14_(Beethoven,_Ludwig_van)'
      );

      expect(slug).toBe('Piano Sonata No.14 (Beethoven, Ludwig van)');
    });

    it('should extract slug from category URL', () => {
      const slug = api.extractSlugFromUrl(
        'https://imslp.org/wiki/Category:Bach,_Johann_Sebastian'
      );

      expect(slug).toBe('Bach, Johann Sebastian');
    });

    it('should return null for invalid URLs', () => {
      const slug = api.extractSlugFromUrl('https://google.com');

      expect(slug).toBeNull();
    });

    it('should handle URLs with query parameters', () => {
      const slug = api.extractSlugFromUrl(
        'https://imslp.org/wiki/Test_Page?action=edit'
      );

      expect(slug).toBe('Test Page');
    });
  });
});
