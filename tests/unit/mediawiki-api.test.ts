import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaWikiApi, MW_NAMESPACE } from '../../src/api/mediawiki-api.js';
import { HttpClient } from '../../src/client/http.js';

// Mock HttpClient
vi.mock('../../src/client/http.js', () => ({
  HttpClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    post: vi.fn(),
  })),
}));

describe('MediaWikiApi', () => {
  let api: MediaWikiApi;
  let mockHttp: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
    };
    api = new MediaWikiApi(mockHttp as unknown as HttpClient);
  });

  describe('openSearch', () => {
    it('should return suggested titles', async () => {
      mockHttp.get.mockResolvedValue({
        data: [
          'moonlight',
          ['Moonlight Sonata', 'Moonlight Serenade', 'Clair de Lune'],
          [],
          [],
        ],
      });

      const results = await api.openSearch('moonlight');

      expect(results).toEqual([
        'Moonlight Sonata',
        'Moonlight Serenade',
        'Clair de Lune',
      ]);
      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            action: 'opensearch',
            search: 'moonlight',
          }),
        })
      );
    });

    it('should handle empty results', async () => {
      mockHttp.get.mockResolvedValue({
        data: ['nonexistent', [], [], []],
      });

      const results = await api.openSearch('nonexistent');

      expect(results).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      mockHttp.get.mockResolvedValue({ data: ['q', [], [], []] });

      await api.openSearch('query', 5);

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 5,
          }),
        })
      );
    });
  });

  describe('search', () => {
    it('should return search results with pagination info', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            searchinfo: { totalhits: 100 },
            search: [
              { ns: 0, title: 'Piano Sonata No.14', pageid: 12345 },
              { ns: 0, title: 'Piano Sonata No.8', pageid: 12346 },
            ],
          },
          continue: { sroffset: 10, continue: '-||' },
        },
      });

      const result = await api.search('piano sonata');

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
      expect(result.results[0].title).toBe('Piano Sonata No.14');
    });

    it('should handle last page of results', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          batchcomplete: '',
          query: {
            searchinfo: { totalhits: 5 },
            search: [{ ns: 0, title: 'Result', pageid: 1 }],
          },
        },
      });

      const result = await api.search('query');

      expect(result.hasMore).toBe(false);
    });

    it('should pass search options', async () => {
      mockHttp.get.mockResolvedValue({
        data: { query: { search: [] } },
      });

      await api.search('query', {
        limit: 20,
        offset: 10,
        namespace: MW_NAMESPACE.CATEGORY,
        what: 'title',
      });

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            srlimit: 20,
            sroffset: 10,
            srnamespace: MW_NAMESPACE.CATEGORY,
            srwhat: 'title',
          }),
        })
      );
    });
  });

  describe('parsePage', () => {
    it('should return parsed page content', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          parse: {
            title: 'Test Page',
            pageid: 123,
            text: { '*': '<p>Content</p>' },
            categories: [{ sortkey: '', '*': 'Category1' }],
          },
        },
      });

      const result = await api.parsePage('Test Page');

      expect(result.title).toBe('Test Page');
      expect(result.pageid).toBe(123);
      expect(result.text?.['*']).toBe('<p>Content</p>');
    });

    it('should fetch wikitext when requested', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          parse: {
            title: 'Test',
            pageid: 1,
            wikitext: { '*': '{{Template|arg=value}}' },
          },
        },
      });

      await api.parsePage('Test', { wikitext: true });

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            prop: expect.stringContaining('wikitext'),
          }),
        })
      );
    });
  });

  describe('getPageWikitext', () => {
    it('should return raw wikitext', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          parse: {
            title: 'Test',
            pageid: 1,
            wikitext: { '*': '{{Composer|name=Bach}}' },
          },
        },
      });

      const wikitext = await api.getPageWikitext('Test');

      expect(wikitext).toBe('{{Composer|name=Bach}}');
    });
  });

  describe('getCategoryMembers', () => {
    it('should return category members with continue token', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            categorymembers: [
              { pageid: 1, ns: 0, title: 'Work 1' },
              { pageid: 2, ns: 0, title: 'Work 2' },
            ],
          },
          continue: { cmcontinue: 'next_token', continue: '-||' },
        },
      });

      const result = await api.getCategoryMembers('Bach, Johann Sebastian');

      expect(result.members).toHaveLength(2);
      expect(result.continueToken).toBe('next_token');
    });

    it('should auto-prefix category name', async () => {
      mockHttp.get.mockResolvedValue({
        data: { query: { categorymembers: [] } },
      });

      await api.getCategoryMembers('Beethoven');

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            cmtitle: 'Category:Beethoven',
          }),
        })
      );
    });

    it('should not double-prefix category name', async () => {
      mockHttp.get.mockResolvedValue({
        data: { query: { categorymembers: [] } },
      });

      await api.getCategoryMembers('Category:Mozart');

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            cmtitle: 'Category:Mozart',
          }),
        })
      );
    });
  });

  describe('getImageInfo', () => {
    it('should return image info', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '123': {
                pageid: 123,
                ns: 6,
                title: 'File:Test.pdf',
                imageinfo: [
                  {
                    timestamp: '2024-01-01T00:00:00Z',
                    user: 'uploader',
                    size: 1024,
                    width: 0,
                    height: 0,
                    url: 'https://imslp.org/images/test.pdf',
                    descriptionurl: 'https://imslp.org/wiki/File:Test.pdf',
                    mime: 'application/pdf',
                    mediatype: 'OFFICE',
                  },
                ],
              },
            },
          },
        },
      });

      const result = await api.getImageInfo('Test.pdf');

      expect(result).not.toBeNull();
      expect(result?.imageinfo?.[0].size).toBe(1024);
    });

    it('should return null for missing files', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '-1': {
                ns: 6,
                title: 'File:Missing.pdf',
                missing: true,
              },
            },
          },
        },
      });

      const result = await api.getImageInfo('Missing.pdf');

      expect(result).toBeNull();
    });
  });

  describe('getPageInfo', () => {
    it('should return info for multiple pages', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          query: {
            pages: {
              '1': { pageid: 1, ns: 0, title: 'Page 1' },
              '2': { pageid: 2, ns: 0, title: 'Page 2' },
              '-1': { ns: 0, title: 'Missing', missing: true },
            },
          },
        },
      });

      const result = await api.getPageInfo(['Page 1', 'Page 2', 'Missing']);

      expect(result.get('Page 1')).toEqual({ pageid: 1, exists: true });
      expect(result.get('Page 2')).toEqual({ pageid: 2, exists: true });
      expect(result.get('Missing')).toEqual({ pageid: -1, exists: false });
    });
  });
});

describe('MW_NAMESPACE', () => {
  it('should have correct namespace values', () => {
    expect(MW_NAMESPACE.MAIN).toBe(0);
    expect(MW_NAMESPACE.CATEGORY).toBe(14);
    expect(MW_NAMESPACE.FILE).toBe(6);
    expect(MW_NAMESPACE.TEMPLATE).toBe(10);
  });
});
