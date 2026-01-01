import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../../src/services/search.js';
import { MediaWikiApi } from '../../../src/api/mediawiki-api.js';
import type { HttpClient } from '../../../src/client/http.js';

// Mock MediaWikiApi
vi.mock('../../../src/api/mediawiki-api.js');

describe('SearchService', () => {
  let service: SearchService;
  let mockApi: MediaWikiApi;

  beforeEach(() => {
    const mockHttp = {} as HttpClient;
    mockApi = new MediaWikiApi(mockHttp);
    service = new SearchService(mockApi);
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search for works and return parsed results', async () => {
      vi.mocked(mockApi.searchWorks).mockResolvedValue({
        results: [
          { title: 'Piano_Sonata_No.14_(Beethoven)', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        {{Work
        |work_title=Piano Sonata No.14
        |opus=Op. 27 No. 2
        |key=C-sharp minor
        |instrumentation=piano
        }}
      `);

      const result = await service.search('moonlight sonata');

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.title).toBe('Piano Sonata No.14');
      expect(mockApi.searchWorks).toHaveBeenCalledWith('moonlight sonata', { limit: 10 });
    });

    it('should apply instrument filter', async () => {
      vi.mocked(mockApi.searchWorks).mockResolvedValue({
        results: [
          { title: 'Violin_Sonata_(Mozart)', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
          { title: 'Piano_Sonata_(Mozart)', pageid: 2, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 2,
        hasMore: false,
      });

      // Return different instrumentation for each work
      vi.mocked(mockApi.getPageWikitext)
        .mockResolvedValueOnce('{{Work|instrumentation=violin, piano}}')
        .mockResolvedValueOnce('{{Work|instrumentation=piano}}');

      const result = await service.search('sonata', { instrument: 'violin' });

      // Only the violin sonata should match
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.instrumentation.some(i => i.normalized === 'violin')).toBe(true);
    });

    it('should handle parse failures gracefully', async () => {
      vi.mocked(mockApi.searchWorks).mockResolvedValue({
        results: [
          { title: 'Test_Work', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      vi.mocked(mockApi.getPageWikitext).mockRejectedValue(new Error('Parse error'));

      const result = await service.search('test');

      expect(result.data.items).toHaveLength(0);
      expect(result.warnings).toContain('Failed to parse work: Test_Work');
    });

    it('should respect limit option', async () => {
      vi.mocked(mockApi.searchWorks).mockResolvedValue({
        results: [],
        total: 0,
        hasMore: false,
      });

      await service.search('test', { limit: 20 });

      expect(mockApi.searchWorks).toHaveBeenCalledWith('test', { limit: 20 });
    });
  });

  describe('searchComposers', () => {
    it('should search for composers in category namespace', async () => {
      vi.mocked(mockApi.searchCategories).mockResolvedValue({
        results: [
          { title: 'Category:Beethoven,_Ludwig_van', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        {{Composer
        |first_name=Ludwig
        |last_name=Beethoven
        |nationality=German
        }}
      `);

      const result = await service.searchComposers('Beethoven');

      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.name).toBe('Ludwig Beethoven');
      expect(mockApi.searchCategories).toHaveBeenCalledWith('Beethoven', { limit: 10 });
    });

    it('should skip non-category results', async () => {
      vi.mocked(mockApi.searchCategories).mockResolvedValue({
        results: [
          { title: 'Beethoven_Works', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await service.searchComposers('Beethoven');

      expect(result.data.items).toHaveLength(0);
      expect(mockApi.getPageWikitext).not.toHaveBeenCalled();
    });
  });

  describe('autocomplete', () => {
    it('should pass through to openSearch', async () => {
      vi.mocked(mockApi.openSearch).mockResolvedValue([
        'Piano Sonata No.14',
        'Piano Sonata No.8',
        'Piano Concerto No.5',
      ]);

      const result = await service.autocomplete('piano', 5);

      expect(result).toHaveLength(3);
      expect(mockApi.openSearch).toHaveBeenCalledWith('piano', 5);
    });
  });

  describe('searchAll', () => {
    it('should search both works and composers in parallel', async () => {
      vi.mocked(mockApi.searchWorks).mockResolvedValue({
        results: [
          { title: 'Piano_Sonata', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      vi.mocked(mockApi.searchCategories).mockResolvedValue({
        results: [
          { title: 'Category:Mozart', pageid: 2, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      vi.mocked(mockApi.getPageWikitext)
        .mockResolvedValueOnce('{{Work|work_title=Piano Sonata}}')
        .mockResolvedValueOnce('{{Composer|first_name=Wolfgang|last_name=Mozart}}');

      const result = await service.searchAll('mozart', 10);

      expect(result.data.works).toHaveLength(1);
      expect(result.data.composers).toHaveLength(1);
    });
  });
});
