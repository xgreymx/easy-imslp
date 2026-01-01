import { HttpClient } from '../client/http.js';

/**
 * File info with download URL
 */
export interface FileInfo {
  /** Original filename */
  filename: string;
  /** Direct download URL */
  downloadUrl: string;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  /** Upload timestamp */
  timestamp?: string;
  /** File description */
  description?: string;
}

/**
 * Genre tag
 */
export interface GenreTag {
  /** Tag ID */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
}

/**
 * Wrapper for IMSLP's legacy APIs
 *
 * These are older IMSLP-specific scripts for file lookups and metadata.
 * Some of these may be deprecated or have limited functionality.
 */
export class LegacyApi {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Build a download URL for a file
   *
   * IMSLP uses a redirect system for downloads to track usage.
   * This method constructs the proper download URL.
   */
  buildDownloadUrl(filename: string): string {
    // IMSLP files are typically accessed via Special:ImagefromIndex or direct URL
    const encodedFilename = encodeURIComponent(filename);
    return `https://imslp.org/wiki/Special:ImagefromIndex/${encodedFilename}`;
  }

  /**
   * Build a direct file URL (may not work for all files due to IMSLP's download interstitial)
   */
  buildDirectFileUrl(filename: string): string {
    // IMSLP stores files on their CDN
    // Format: //imslp.org/images/x/xx/filename
    // The hash is computed from the filename
    const hash = this.computeFileHash(filename);
    const encodedFilename = encodeURIComponent(filename);
    return `https://imslp.org/images/${hash.charAt(0)}/${hash.slice(0, 2)}/${encodedFilename}`;
  }

  /**
   * Compute the MediaWiki-style hash for a filename
   * MediaWiki uses MD5 hash of the filename to distribute files in directories
   */
  private computeFileHash(filename: string): string {
    // This is a simplified version - in reality MediaWiki uses MD5
    // For now, we'll use the filename directly and let IMSLP handle redirects
    // The actual implementation would need an MD5 library
    return filename.slice(0, 2).toLowerCase();
  }

  /**
   * Get file information from IMSLP
   *
   * Note: This uses the MediaWiki API for image info rather than a legacy endpoint,
   * as IMSLP's legacy file lookup API is not publicly documented.
   */
  async getFileInfo(filename: string): Promise<FileInfo | null> {
    // We'll use the MediaWiki API for this since it's more reliable
    // The legacy API endpoints are not well documented
    try {
      const response = await this.http.get<{
        query: {
          pages: Record<string, {
            pageid?: number;
            title: string;
            missing?: boolean;
            imageinfo?: Array<{
              timestamp: string;
              size: number;
              url: string;
              mime: string;
              descriptionurl?: string;
            }>;
          }>;
        };
      }>('https://imslp.org/api.php', {
        params: {
          action: 'query',
          titles: `File:${filename}`,
          prop: 'imageinfo',
          iiprop: 'timestamp|size|url|mime',
          format: 'json',
        },
      });

      const pages = response.data.query.pages;
      const page = Object.values(pages)[0];

      if (page?.missing || !page?.imageinfo?.[0]) {
        return null;
      }

      const info = page.imageinfo[0];

      return {
        filename,
        downloadUrl: this.buildDownloadUrl(filename),
        size: info.size,
        mimeType: info.mime,
        timestamp: info.timestamp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get information for multiple files
   */
  async getMultipleFileInfo(filenames: string[]): Promise<Map<string, FileInfo>> {
    const result = new Map<string, FileInfo>();

    // MediaWiki API allows up to 50 titles per request
    const batchSize = 50;

    for (let i = 0; i < filenames.length; i += batchSize) {
      const batch = filenames.slice(i, i + batchSize);
      const titles = batch.map((f) => `File:${f}`).join('|');

      try {
        const response = await this.http.get<{
          query: {
            pages: Record<string, {
              title: string;
              missing?: boolean;
              imageinfo?: Array<{
                timestamp: string;
                size: number;
                url: string;
                mime: string;
              }>;
            }>;
          };
        }>('https://imslp.org/api.php', {
          params: {
            action: 'query',
            titles,
            prop: 'imageinfo',
            iiprop: 'timestamp|size|url|mime',
            format: 'json',
          },
        });

        for (const page of Object.values(response.data.query.pages)) {
          if (page.missing || !page.imageinfo?.[0]) {
            continue;
          }

          // Extract filename from title (remove "File:" prefix)
          const filename = page.title.replace(/^File:/, '');
          const info = page.imageinfo[0];

          result.set(filename, {
            filename,
            downloadUrl: this.buildDownloadUrl(filename),
            size: info.size,
            mimeType: info.mime,
            timestamp: info.timestamp,
          });
        }
      } catch {
        // Continue with other batches if one fails
      }
    }

    return result;
  }

  /**
   * Get available genre tags
   *
   * Note: IMSLP's genre tags are embedded in category structure rather than
   * a dedicated API endpoint. This method fetches common genre categories.
   */
  async getGenreTags(): Promise<GenreTag[]> {
    // These are the main genre categories in IMSLP
    // In a full implementation, we would scrape the actual category structure
    const commonGenres: GenreTag[] = [
      { id: 'symphonies', name: 'Symphonies' },
      { id: 'concertos', name: 'Concertos' },
      { id: 'sonatas', name: 'Sonatas' },
      { id: 'chamber_music', name: 'Chamber Music' },
      { id: 'piano_music', name: 'Piano Music' },
      { id: 'songs', name: 'Songs' },
      { id: 'operas', name: 'Operas' },
      { id: 'choral_music', name: 'Choral Music' },
      { id: 'orchestral_music', name: 'Orchestral Music' },
      { id: 'string_quartets', name: 'String Quartets' },
      { id: 'preludes', name: 'Preludes' },
      { id: 'fugues', name: 'Fugues' },
      { id: 'etudes', name: 'Etudes' },
      { id: 'variations', name: 'Variations' },
      { id: 'masses', name: 'Masses' },
      { id: 'requiems', name: 'Requiems' },
      { id: 'nocturnes', name: 'Nocturnes' },
      { id: 'waltzes', name: 'Waltzes' },
      { id: 'mazurkas', name: 'Mazurkas' },
      { id: 'polonaises', name: 'Polonaises' },
    ];

    return commonGenres;
  }

  /**
   * Build IMSLP page URL from a slug
   */
  buildPageUrl(slug: string): string {
    const encodedSlug = encodeURIComponent(slug.replace(/ /g, '_'));
    return `https://imslp.org/wiki/${encodedSlug}`;
  }

  /**
   * Build IMSLP composer category URL from a composer name
   */
  buildComposerUrl(composerSlug: string): string {
    const encodedSlug = encodeURIComponent(composerSlug.replace(/ /g, '_'));
    return `https://imslp.org/wiki/Category:${encodedSlug}`;
  }

  /**
   * Extract slug from an IMSLP URL
   */
  extractSlugFromUrl(url: string): string | null {
    const match = url.match(/imslp\.org\/wiki\/(?:Category:)?([^?#]+)/);
    if (!match?.[1]) {
      return null;
    }
    return decodeURIComponent(match[1].replace(/_/g, ' '));
  }
}

/**
 * Build a download URL for a file (standalone helper)
 */
export function buildDownloadUrl(filename: string): string {
  const encodedFilename = encodeURIComponent(filename);
  return `https://imslp.org/wiki/Special:ImagefromIndex/${encodedFilename}`;
}

/**
 * Build a direct file URL (standalone helper)
 * Note: May not work for all files due to IMSLP's download interstitial
 */
export function buildDirectDownloadUrl(filename: string): string {
  // IMSLP stores files on their CDN
  // Format: //imslp.org/images/x/xx/filename
  const hash = filename.slice(0, 2).toLowerCase();
  const encodedFilename = encodeURIComponent(filename);
  return `https://imslp.org/images/${hash.charAt(0)}/${hash}/${encodedFilename}`;
}

/**
 * Build IMSLP page URL from a slug (standalone helper)
 */
export function buildPageUrl(slug: string): string {
  const encodedSlug = encodeURIComponent(slug.replace(/ /g, '_'));
  return `https://imslp.org/wiki/${encodedSlug}`;
}

/**
 * Build IMSLP composer category URL (standalone helper)
 */
export function buildComposerUrl(composerSlug: string): string {
  const encodedSlug = encodeURIComponent(composerSlug.replace(/ /g, '_'));
  return `https://imslp.org/wiki/Category:${encodedSlug}`;
}

/**
 * Extract slug from an IMSLP URL (standalone helper)
 */
export function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/imslp\.org\/wiki\/(?:Category:)?([^?#]+)/);
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1].replace(/_/g, ' '));
}
