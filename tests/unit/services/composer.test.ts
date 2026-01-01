import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComposerService } from '../../../src/services/composer.js';
import { MediaWikiApi } from '../../../src/api/mediawiki-api.js';
import { CustomApi } from '../../../src/api/custom-api.js';
import { NotFoundError } from '../../../src/errors/errors.js';
import type { HttpClient } from '../../../src/client/http.js';

// Mock APIs
vi.mock('../../../src/api/mediawiki-api.js');
vi.mock('../../../src/api/custom-api.js');

describe('ComposerService', () => {
  let service: ComposerService;
  let mockMediaWiki: MediaWikiApi;
  let mockCustomApi: CustomApi;

  beforeEach(() => {
    const mockHttp = {} as HttpClient;
    mockMediaWiki = new MediaWikiApi(mockHttp);
    mockCustomApi = new CustomApi(mockHttp);
    service = new ComposerService(mockMediaWiki, mockCustomApi);
    vi.clearAllMocks();
  });

  describe('getComposer', () => {
    it('should get composer by slug', async () => {
      vi.mocked(mockMediaWiki.getPageWikitext).mockResolvedValue(`
        {{Composer
        |first_name=Ludwig
        |last_name=Beethoven
        |birth_date=1770
        |death_date=1827
        |nationality=German
        |time_period=Classical
        }}
      `);

      const result = await service.getComposer('Beethoven,_Ludwig_van');

      expect(result.data.name).toBe('Ludwig Beethoven');
      expect(result.data.birthYear).toBe(1770);
      expect(result.data.deathYear).toBe(1827);
      expect(result.data.nationality).toBe('German');
      expect(mockMediaWiki.getPageWikitext).toHaveBeenCalledWith('Category:Beethoven,_Ludwig_van');
    });

    it('should normalize slug with spaces', async () => {
      vi.mocked(mockMediaWiki.getPageWikitext).mockResolvedValue('{{Composer|first_name=Johann|last_name=Bach}}');

      await service.getComposer('Bach, Johann Sebastian');

      expect(mockMediaWiki.getPageWikitext).toHaveBeenCalledWith('Category:Bach,_Johann_Sebastian');
    });

    it('should throw NotFoundError when composer not found', async () => {
      vi.mocked(mockMediaWiki.getPageWikitext).mockResolvedValue('');

      await expect(service.getComposer('Nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError on API error', async () => {
      vi.mocked(mockMediaWiki.getPageWikitext).mockRejectedValue(new Error('API error'));

      await expect(service.getComposer('Test')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findComposer', () => {
    it('should find composer using fuzzy matching', async () => {
      vi.mocked(mockMediaWiki.openSearch).mockResolvedValue([
        'Category:Beethoven,_Ludwig_van',
        'Category:Becker,_Albert',
      ]);

      vi.mocked(mockMediaWiki.getPageWikitext).mockResolvedValue(`
        {{Composer|first_name=Ludwig|last_name=Beethoven}}
      `);

      const result = await service.findComposer('beethoven');

      expect(result.data).not.toBeNull();
      expect(result.data?.name).toBe('Ludwig Beethoven');
    });

    it('should return null when no match found', async () => {
      vi.mocked(mockMediaWiki.openSearch).mockResolvedValue([]);

      const result = await service.findComposer('nonexistent');

      expect(result.data).toBeNull();
      expect(result.warnings).toContain('No composer found for query: nonexistent');
    });

    it('should filter non-category results', async () => {
      vi.mocked(mockMediaWiki.openSearch).mockResolvedValue([
        'Beethoven_Symphony_No.5',
        'Beethoven_Piano_Sonata',
      ]);

      const result = await service.findComposer('beethoven');

      expect(result.data).toBeNull();
    });
  });

  describe('browseAllComposers', () => {
    it('should iterate through composers', async () => {
      const mockGenerator = async function* () {
        yield { id: '1', slug: 'Beethoven, Ludwig van', type: '1' as const };
        yield { id: '2', slug: 'Mozart, Wolfgang Amadeus', type: '1' as const };
      };

      vi.mocked(mockCustomApi.browseAllComposers).mockImplementation(mockGenerator);

      vi.mocked(mockMediaWiki.getPageWikitext)
        .mockResolvedValueOnce('{{Composer|first_name=Ludwig|last_name=Beethoven}}')
        .mockResolvedValueOnce('{{Composer|first_name=Wolfgang|last_name=Mozart}}');

      const composers = [];
      for await (const result of service.browseAllComposers()) {
        composers.push(result.data);
      }

      expect(composers).toHaveLength(2);
      expect(composers[0]?.name).toBe('Ludwig Beethoven');
      expect(composers[1]?.name).toBe('Wolfgang Mozart');
    });

    it('should handle parse failures gracefully', async () => {
      const mockGenerator = async function* () {
        yield { id: '1', slug: 'Test Composer', type: '1' as const };
      };

      vi.mocked(mockCustomApi.browseAllComposers).mockImplementation(mockGenerator);
      vi.mocked(mockMediaWiki.getPageWikitext).mockRejectedValue(new Error('Parse error'));

      const composers = [];
      for await (const result of service.browseAllComposers()) {
        composers.push(result);
      }

      expect(composers).toHaveLength(1);
      expect(composers[0]?.warnings).toContain('Failed to fully parse composer: Test Composer');
    });
  });

  describe('getComposersByLetter', () => {
    it('should get composers starting with a letter', async () => {
      vi.mocked(mockMediaWiki.searchCategories).mockResolvedValue({
        results: [
          { title: 'Category:Bach,_Johann_Sebastian', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
          { title: 'Category:Beethoven,_Ludwig_van', pageid: 2, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 2,
        hasMore: false,
      });

      vi.mocked(mockMediaWiki.getPageWikitext)
        .mockResolvedValueOnce('{{Composer|first_name=Johann|last_name=Bach}}')
        .mockResolvedValueOnce('{{Composer|first_name=Ludwig|last_name=Beethoven}}');

      const result = await service.getComposersByLetter('B');

      expect(result.data).toHaveLength(2);
    });

    it('should filter out non-matching composers', async () => {
      vi.mocked(mockMediaWiki.searchCategories).mockResolvedValue({
        results: [
          { title: 'Category:Mozart,_Wolfgang_Amadeus', pageid: 1, size: 100, wordcount: 50, timestamp: '' },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await service.getComposersByLetter('B');

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getWorksCount', () => {
    it('should return -1 when works exist', async () => {
      vi.mocked(mockMediaWiki.getCategoryMembers).mockResolvedValue({
        members: [{ pageid: 1, title: 'Test Work' }],
        continueToken: 'abc',
      });

      const count = await service.getWorksCount('Beethoven');

      expect(count).toBe(-1); // -1 means "at least 1"
    });

    it('should return 0 when no works exist', async () => {
      vi.mocked(mockMediaWiki.getCategoryMembers).mockResolvedValue({
        members: [],
      });

      const count = await service.getWorksCount('Unknown');

      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      vi.mocked(mockMediaWiki.getCategoryMembers).mockRejectedValue(new Error('Error'));

      const count = await service.getWorksCount('Test');

      expect(count).toBe(0);
    });
  });
});
