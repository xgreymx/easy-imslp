import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkService } from '../../../src/services/work.js';
import { MediaWikiApi } from '../../../src/api/mediawiki-api.js';
import { NotFoundError } from '../../../src/errors/errors.js';
import type { HttpClient } from '../../../src/client/http.js';
import type { Work } from '../../../src/models/work.js';

// Mock MediaWikiApi
vi.mock('../../../src/api/mediawiki-api.js');

describe('WorkService', () => {
  let service: WorkService;
  let mockApi: MediaWikiApi;

  beforeEach(() => {
    const mockHttp = {} as HttpClient;
    mockApi = new MediaWikiApi(mockHttp);
    service = new WorkService(mockApi);
    vi.clearAllMocks();
  });

  describe('getWork', () => {
    it('should get work by slug', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        {{Work
        |work_title=Piano Sonata No.14
        |opus=Op. 27 No. 2
        |key=C-sharp minor
        |year=1801
        |instrumentation=piano
        |genre=Sonata
        }}
      `);

      const result = await service.getWork('Piano_Sonata_No.14_(Beethoven,_Ludwig_van)');

      expect(result.data.title).toBe('Piano Sonata No.14');
      expect(result.data.opus).toBe('Op. 27 No. 2');
      expect(result.data.key).toBe('C-sharp minor');
      expect(result.data.year).toBe(1801);
    });

    it('should normalize slug with spaces', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|work_title=Test}}');

      await service.getWork('Test Work (Composer)');

      expect(mockApi.getPageWikitext).toHaveBeenCalledWith('Test_Work_(Composer)');
    });

    it('should return work with methods', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|work_title=Test}}');

      const result = await service.getWork('Test');

      expect(typeof result.data.validate).toBe('function');
      expect(typeof result.data.enrich).toBe('function');
    });

    it('should throw NotFoundError when work not found', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('');

      await expect(service.getWork('Nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findWork', () => {
    it('should find work using fuzzy matching', async () => {
      vi.mocked(mockApi.openSearch).mockResolvedValue([
        'Piano_Sonata_No.14_(Beethoven)',
        'Piano_Sonata_No.8_(Beethoven)',
      ]);

      vi.mocked(mockApi.getPageWikitext).mockResolvedValue(`
        {{Work|work_title=Piano Sonata No.14}}
      `);

      const result = await service.findWork('moonlight sonata');

      expect(result.data).not.toBeNull();
      expect(result.data?.title).toBe('Piano Sonata No.14');
    });

    it('should return null when no match found', async () => {
      vi.mocked(mockApi.openSearch).mockResolvedValue([]);

      const result = await service.findWork('nonexistent');

      expect(result.data).toBeNull();
      expect(result.warnings).toContain('No work found for query: nonexistent');
    });

    it('should skip category results', async () => {
      vi.mocked(mockApi.openSearch).mockResolvedValue([
        'Category:Beethoven',
      ]);

      const result = await service.findWork('beethoven');

      expect(result.data).toBeNull();
    });
  });

  describe('browseComposerWorks', () => {
    it('should iterate through composer works', async () => {
      const mockGenerator = async function* () {
        yield { pageid: 1, title: 'Piano_Sonata_No.14' };
        yield { pageid: 2, title: 'Piano_Sonata_No.8' };
      };

      vi.mocked(mockApi.browseCategoryMembers).mockImplementation(mockGenerator);

      vi.mocked(mockApi.getPageWikitext)
        .mockResolvedValueOnce('{{Work|work_title=Piano Sonata No.14}}')
        .mockResolvedValueOnce('{{Work|work_title=Piano Sonata No.8}}');

      const works = [];
      for await (const result of service.browseComposerWorks('Beethoven')) {
        works.push(result.data);
      }

      expect(works).toHaveLength(2);
      expect(works[0]?.title).toBe('Piano Sonata No.14');
      expect(works[1]?.title).toBe('Piano Sonata No.8');
    });

    it('should skip subcategories', async () => {
      const mockGenerator = async function* () {
        yield { pageid: 1, title: 'Category:Subcategory' };
        yield { pageid: 2, title: 'Piano_Sonata' };
      };

      vi.mocked(mockApi.browseCategoryMembers).mockImplementation(mockGenerator);
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|work_title=Piano Sonata}}');

      const works = [];
      for await (const result of service.browseComposerWorks('Composer')) {
        works.push(result.data);
      }

      expect(works).toHaveLength(1);
      expect(works[0]?.title).toBe('Piano Sonata');
    });

    it('should handle parse failures gracefully', async () => {
      const mockGenerator = async function* () {
        yield { pageid: 1, title: 'Test_Work' };
      };

      vi.mocked(mockApi.browseCategoryMembers).mockImplementation(mockGenerator);
      vi.mocked(mockApi.getPageWikitext).mockRejectedValue(new Error('Parse error'));

      const works = [];
      for await (const result of service.browseComposerWorks('Composer')) {
        works.push(result);
      }

      expect(works).toHaveLength(1);
      expect(works[0]?.warnings).toContain('Failed to fully parse work: Test_Work');
    });
  });

  describe('getComposerWorks', () => {
    it('should get paginated works for composer', async () => {
      vi.mocked(mockApi.getCategoryMembers).mockResolvedValue({
        members: [
          { pageid: 1, title: 'Work1' },
          { pageid: 2, title: 'Work2' },
        ],
        continueToken: undefined,
      });

      vi.mocked(mockApi.getPageWikitext)
        .mockResolvedValueOnce('{{Work|work_title=Work 1}}')
        .mockResolvedValueOnce('{{Work|work_title=Work 2}}');

      const result = await service.getComposerWorks('Composer', 10);

      expect(result.data).toHaveLength(2);
    });
  });

  describe('validateWork', () => {
    it('should return valid for complete work', () => {
      const work: Work = {
        slug: 'test',
        title: 'Test Work',
        fullTitle: 'Test Work, Op.1',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        year: 1800,
        key: 'C major',
        instrumentation: [{ raw: 'piano', normalized: 'piano' }],
      };

      const result = service.validateWork(work);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report error for missing title', () => {
      const work: Work = {
        slug: 'test',
        title: '',
        fullTitle: '',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        instrumentation: [],
      };

      const result = service.validateWork(work);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'title' && i.severity === 'error')).toBe(true);
    });

    it('should report warning for missing instrumentation', () => {
      const work: Work = {
        slug: 'test',
        title: 'Test',
        fullTitle: 'Test',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        instrumentation: [],
      };

      const result = service.validateWork(work);

      expect(result.valid).toBe(true);
      expect(result.issues.some(i => i.field === 'instrumentation' && i.severity === 'warning')).toBe(true);
    });

    it('should report warning for invalid year', () => {
      const work: Work = {
        slug: 'test',
        title: 'Test',
        fullTitle: 'Test',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        year: 500, // Invalid year
        instrumentation: [],
      };

      const result = service.validateWork(work);

      expect(result.issues.some(i => i.field === 'year' && i.message.includes('invalid'))).toBe(true);
    });

    it('should report warning for invalid difficulty', () => {
      const work: Work = {
        slug: 'test',
        title: 'Test',
        fullTitle: 'Test',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        difficulty: { level: 15, description: 'Invalid' },
        instrumentation: [],
      };

      const result = service.validateWork(work);

      expect(result.issues.some(i => i.field === 'difficulty' && i.message.includes('out of range'))).toBe(true);
    });
  });

  describe('enrichWork', () => {
    it('should return enriched work with placeholder values', async () => {
      const work: Work = {
        slug: 'test',
        title: 'Test',
        fullTitle: 'Test',
        url: 'https://imslp.org/wiki/test',
        composer: { slug: 'composer', name: 'Composer' },
        instrumentation: [],
      };

      const enriched = await service.enrichWork(work);

      expect(enriched.title).toBe('Test');
      expect(enriched.downloadCount).toBeUndefined();
      expect(enriched.userRating).toBeUndefined();
    });
  });

  describe('work.validate() method', () => {
    it('should work when called on returned work', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|work_title=Test|composer=Test Composer}}');

      const result = await service.getWork('Test_(Composer)');
      const validation = result.data.validate();

      // Should be valid (has title and composer), though may have warnings
      expect(validation.valid).toBe(true);
    });
  });

  describe('work.enrich() method', () => {
    it('should work when called on returned work', async () => {
      vi.mocked(mockApi.getPageWikitext).mockResolvedValue('{{Work|work_title=Test}}');

      const result = await service.getWork('test');
      const enriched = await result.data.enrich();

      expect(enriched.title).toBe('Test');
    });
  });
});
