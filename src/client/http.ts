import { Cache, createCacheKey } from '../utils/cache.js';
import {
  NetworkError,
  RateLimitError,
  TimeoutError,
  NotFoundError,
} from '../errors/errors.js';
import { DEFAULT_CONFIG, type ClientConfig } from './types.js';

/**
 * HTTP response with parsed data
 */
export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  /** HTTP method */
  method?: 'GET' | 'POST';
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body for POST */
  body?: string | Record<string, unknown>;
  /** Override timeout for this request */
  timeout?: number;
  /** Skip cache for this request */
  skipCache?: boolean;
}

/**
 * HTTP client with caching, rate limiting, and error handling
 */
export class HttpClient {
  private readonly config: Required<ClientConfig>;
  private readonly cache: Cache<unknown>;
  private lastRequestTime = 0;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(config: ClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Cache(this.config.cacheTTL);
  }

  /**
   * Build a URL with query parameters
   */
  private buildUrl(
    baseUrl: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    if (!params) {
      return baseUrl;
    }

    const url = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Wait for rate limit delay
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delay = this.config.rateLimitDelay - elapsed;

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Create an AbortController with timeout
   */
  private createTimeoutController(
    timeoutMs: number
  ): [AbortController, NodeJS.Timeout] {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return [controller, timeoutId];
  }

  /**
   * Make an HTTP request with caching and rate limiting
   */
  async request<T>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      params,
      headers = {},
      body,
      timeout = this.config.timeout,
      skipCache = false,
    } = options;

    const fullUrl = this.buildUrl(url, params);

    // Check cache for GET requests
    if (method === 'GET' && this.config.cache && !skipCache) {
      const cacheKey = createCacheKey('http', fullUrl);
      const cached = this.cache.get(cacheKey) as HttpResponse<T> | null;
      if (cached) {
        return cached;
      }
    }

    // Queue the request to respect rate limiting
    const result = await this.enqueueRequest<T>(async () => {
      await this.waitForRateLimit();

      const [controller, timeoutId] = this.createTimeoutController(timeout);

      try {
        const requestHeaders: Record<string, string> = {
          'User-Agent': this.config.userAgent,
          ...headers,
        };

        const requestInit: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body) {
          if (typeof body === 'string') {
            requestInit.body = body;
          } else {
            requestInit.body = JSON.stringify(body);
            requestHeaders['Content-Type'] = 'application/json';
          }
        }

        const response = await fetch(fullUrl, requestInit);
        clearTimeout(timeoutId);

        // Handle error status codes
        if (!response.ok) {
          await this.handleErrorResponse(response, fullUrl);
        }

        const data = (await response.json()) as T;

        const result: HttpResponse<T> = {
          data,
          status: response.status,
          headers: response.headers,
        };

        // Cache successful GET requests
        if (method === 'GET' && this.config.cache && !skipCache) {
          const cacheKey = createCacheKey('http', fullUrl);
          this.cache.set(cacheKey, result);
        }

        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw this.transformError(error, fullUrl, timeout);
      }
    });

    return result;
  }

  /**
   * Enqueue a request to ensure serial execution for rate limiting
   */
  private async enqueueRequest<T>(
    requestFn: () => Promise<HttpResponse<T>>
  ): Promise<HttpResponse<T>> {
    // Chain onto the queue
    const resultPromise = this.requestQueue.then(requestFn).catch((error) => {
      // Re-throw to propagate to caller
      throw error;
    });

    // Update queue to wait for this request (ignore errors in queue chain)
    this.requestQueue = resultPromise.then(
      () => {},
      () => {}
    );

    return resultPromise;
  }

  /**
   * Handle HTTP error responses
   */
  private async handleErrorResponse(
    response: Response,
    url: string
  ): Promise<never> {
    const status = response.status;
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
    } catch {
      // Ignore body read errors
    }

    if (status === 404) {
      throw new NotFoundError(`Resource not found: ${url}`, {
        url,
        statusCode: status,
        responseBody,
      });
    }

    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;

      throw new RateLimitError(
        'Rate limit exceeded',
        {
          url,
          statusCode: status,
          responseBody,
        },
        retryAfterSeconds
      );
    }

    throw new NetworkError(`HTTP error ${status}`, {
      url,
      statusCode: status,
      responseBody,
      suggestion: `Server returned status ${status}. Check if IMSLP is available.`,
    });
  }

  /**
   * Transform fetch errors into typed errors
   */
  private transformError(
    error: unknown,
    url: string,
    timeout: number
  ): IMSLPError {
    if (error instanceof IMSLPError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for abort/timeout
      if (error.name === 'AbortError') {
        return new TimeoutError(`Request timed out after ${timeout}ms`, timeout, {
          url,
        });
      }

      // Check for network errors
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return new NetworkError(`Network error: ${error.message}`, { url }, error);
      }

      return new NetworkError(error.message, { url }, error);
    }

    return new NetworkError('Unknown network error', { url });
  }

  /**
   * Make a GET request
   */
  async get<T>(
    url: string,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T>(
    url: string,
    body?: string | Record<string, unknown>,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }

  /**
   * Set rate limit delay
   */
  setRateLimit(delayMs: number): void {
    this.config.rateLimitDelay = delayMs;
  }
}

// Import IMSLPError for type checking
import { IMSLPError } from '../errors/errors.js';
