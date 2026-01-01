import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomApi, PERSON_TYPE } from '../../src/api/custom-api.js';
import { HttpClient } from '../../src/client/http.js';

describe('CustomApi', () => {
  let api: CustomApi;
  let mockHttp: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
    };
    api = new CustomApi(mockHttp as unknown as HttpClient);
  });

  describe('listPeople', () => {
    it('should return parsed people list', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          metadata: {
            timestamp: '2024-01-01',
            apiversion: '1.0',
            apilicense: 'CC',
            apirate: '100/hour',
            totalpeople: 50000,
          },
          people: {
            'Bach,_Johann_Sebastian': { id: '1', type: '1' },
            'Beethoven,_Ludwig_van': { id: '2', type: '1' },
          },
        },
      });

      const result = await api.listPeople();

      expect(result.people).toHaveLength(2);
      expect(result.total).toBe(50000);
      expect(result.hasMore).toBe(true);
      expect(result.people[0].slug).toBe('Bach, Johann Sebastian');
      expect(result.people[0].type).toBe('1');
    });

    it('should handle empty results', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          metadata: { totalpeople: 0 },
          people: {},
        },
      });

      const result = await api.listPeople();

      expect(result.people).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should pass options correctly', async () => {
      mockHttp.get.mockResolvedValue({
        data: { metadata: {}, people: {} },
      });

      await api.listPeople({ type: PERSON_TYPE.PERFORMER, start: 10, limit: 50 });

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://imslp.org/imslpscripts/API.ISCR.php',
        expect.objectContaining({
          params: expect.objectContaining({
            account: expect.stringContaining('type=2'),
            account: expect.stringContaining('start=10'),
            account: expect.stringContaining('limit=50'),
          }),
        })
      );
    });
  });

  describe('listComposers', () => {
    it('should call listPeople with composer type', async () => {
      mockHttp.get.mockResolvedValue({
        data: { metadata: { totalpeople: 0 }, people: {} },
      });

      await api.listComposers({ limit: 10 });

      expect(mockHttp.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            account: expect.stringContaining('type=1'),
          }),
        })
      );
    });
  });

  describe('listPerformers', () => {
    it('should call listPeople with performer type', async () => {
      mockHttp.get.mockResolvedValue({
        data: { metadata: { totalpeople: 0 }, people: {} },
      });

      await api.listPerformers();

      expect(mockHttp.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            account: expect.stringContaining('type=2'),
          }),
        })
      );
    });
  });

  describe('listWorks', () => {
    it('should return parsed works list', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          metadata: {
            timestamp: '2024-01-01',
            apiversion: '1.0',
            apilicense: 'CC',
            apirate: '100/hour',
            totalworks: 100000,
          },
          works: {
            'Piano_Sonata_No.14_(Beethoven)': {
              id: '1',
              type: 'work',
              intvals: {
                composer: 'Beethoven, Ludwig van',
                worktitle: 'Piano Sonata No.14',
                icatno: 'Op.27 No.2',
                pageid: '12345',
              },
              permlink: '/wiki/Piano_Sonata_No.14_(Beethoven)',
            },
          },
        },
      });

      const result = await api.listWorks();

      expect(result.works).toHaveLength(1);
      expect(result.total).toBe(100000);
      expect(result.hasMore).toBe(true);
      expect(result.works[0].slug).toBe('Piano Sonata No.14 (Beethoven)');
      expect(result.works[0].title).toBe('Piano Sonata No.14');
      expect(result.works[0].catalogueNumber).toBe('Op.27 No.2');
    });

    it('should handle works with missing intvals', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          metadata: { totalworks: 1 },
          works: {
            Work_Without_Metadata: { id: '1', type: 'work' },
          },
        },
      });

      const result = await api.listWorks();

      expect(result.works[0].title).toBeUndefined();
      expect(result.works[0].composerSlug).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should return API metadata', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          metadata: {
            timestamp: '2024-01-01T12:00:00',
            apiversion: '2.0',
            apilicense: 'CC BY-SA',
            apirate: '200/hour',
            totalpeople: 25000,
            totalworks: 150000,
          },
        },
      });

      const result = await api.getMetadata();

      expect(result.timestamp).toBe('2024-01-01T12:00:00');
      expect(result.version).toBe('2.0');
      expect(result.rateLimit).toBe('200/hour');
      expect(result.totalComposers).toBe(25000);
      expect(result.totalWorks).toBe(150000);
    });
  });
});

describe('PERSON_TYPE', () => {
  it('should have correct type values', () => {
    expect(PERSON_TYPE.COMPOSER).toBe('1');
    expect(PERSON_TYPE.PERFORMER).toBe('2');
    expect(PERSON_TYPE.EDITOR).toBe('3');
    expect(PERSON_TYPE.LIBRETTIST).toBe('4');
  });
});
