import { describe, it, expect } from 'vitest';
import {
  IMSLPError,
  NetworkError,
  RateLimitError,
  NotFoundError,
  ParseError,
  TimeoutError,
  isIMSLPError,
  isNetworkError,
  isRateLimitError,
  isNotFoundError,
  isParseError,
  isTimeoutError,
} from '../../src/errors/errors.js';

describe('IMSLPError', () => {
  it('should create error with message and code', () => {
    const error = new IMSLPError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('IMSLPError');
  });

  it('should include details', () => {
    const error = new IMSLPError('Test error', 'TEST_CODE', {
      url: 'https://example.com',
      statusCode: 500,
      suggestion: 'Try again',
    });

    expect(error.details.url).toBe('https://example.com');
    expect(error.details.statusCode).toBe(500);
    expect(error.details.suggestion).toBe('Try again');
  });

  it('should include cause', () => {
    const cause = new Error('Original error');
    const error = new IMSLPError('Wrapped error', 'TEST_CODE', {}, cause);

    expect(error.cause).toBe(cause);
  });

  describe('toDetailedString', () => {
    it('should format error with all details', () => {
      const error = new IMSLPError('Test error', 'TEST_CODE', {
        url: 'https://example.com',
        statusCode: 500,
        suggestion: 'Try again',
        responseBody: 'Error response',
      });

      const detailed = error.toDetailedString();

      expect(detailed).toContain('IMSLPError: Test error');
      expect(detailed).toContain('Code: TEST_CODE');
      expect(detailed).toContain('URL: https://example.com');
      expect(detailed).toContain('Status: 500');
      expect(detailed).toContain('Suggestion: Try again');
      expect(detailed).toContain('Response: Error response');
    });

    it('should truncate long response bodies', () => {
      const longBody = 'x'.repeat(300);
      const error = new IMSLPError('Test error', 'TEST_CODE', {
        responseBody: longBody,
      });

      const detailed = error.toDetailedString();

      expect(detailed).toContain('...');
      expect(detailed.length).toBeLessThan(longBody.length + 200);
    });
  });
});

describe('NetworkError', () => {
  it('should have correct name and code', () => {
    const error = new NetworkError('Connection failed');

    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('should be instance of IMSLPError', () => {
    const error = new NetworkError('Connection failed');

    expect(error).toBeInstanceOf(IMSLPError);
  });
});

describe('RateLimitError', () => {
  it('should have correct name and code', () => {
    const error = new RateLimitError('Too many requests');

    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
  });

  it('should include retryAfter', () => {
    const error = new RateLimitError('Too many requests', {}, 30);

    expect(error.retryAfter).toBe(30);
  });

  it('should add default suggestion', () => {
    const error = new RateLimitError('Too many requests', {}, 30);

    expect(error.details.suggestion).toContain('30');
    expect(error.details.suggestion).toContain('seconds');
  });
});

describe('NotFoundError', () => {
  it('should have correct name and code', () => {
    const error = new NotFoundError('Work not found');

    expect(error.name).toBe('NotFoundError');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should add default suggestion', () => {
    const error = new NotFoundError('Work not found');

    expect(error.details.suggestion).toContain('findWork()');
  });
});

describe('ParseError', () => {
  it('should have correct name and code', () => {
    const error = new ParseError('Invalid JSON');

    expect(error.name).toBe('ParseError');
    expect(error.code).toBe('PARSE_ERROR');
  });

  it('should include raw data', () => {
    const rawData = { invalid: 'data' };
    const error = new ParseError('Parse failed', {}, rawData);

    expect(error.rawData).toEqual(rawData);
  });
});

describe('TimeoutError', () => {
  it('should have correct name and code', () => {
    const error = new TimeoutError('Request timed out', 5000);

    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('TIMEOUT_ERROR');
  });

  it('should include timeout value', () => {
    const error = new TimeoutError('Request timed out', 5000);

    expect(error.timeoutMs).toBe(5000);
  });

  it('should be instance of NetworkError', () => {
    const error = new TimeoutError('Request timed out', 5000);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(IMSLPError);
  });
});

describe('Type guards', () => {
  const imslpError = new IMSLPError('test', 'TEST');
  const networkError = new NetworkError('test');
  const rateLimitError = new RateLimitError('test');
  const notFoundError = new NotFoundError('test');
  const parseError = new ParseError('test');
  const timeoutError = new TimeoutError('test', 1000);
  const regularError = new Error('test');

  describe('isIMSLPError', () => {
    it('should return true for IMSLP errors', () => {
      expect(isIMSLPError(imslpError)).toBe(true);
      expect(isIMSLPError(networkError)).toBe(true);
      expect(isIMSLPError(rateLimitError)).toBe(true);
      expect(isIMSLPError(notFoundError)).toBe(true);
      expect(isIMSLPError(parseError)).toBe(true);
      expect(isIMSLPError(timeoutError)).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isIMSLPError(regularError)).toBe(false);
      expect(isIMSLPError(null)).toBe(false);
      expect(isIMSLPError(undefined)).toBe(false);
      expect(isIMSLPError('string')).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isNetworkError(imslpError)).toBe(false);
      expect(isNetworkError(rateLimitError)).toBe(false);
      expect(isNetworkError(regularError)).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for rate limit errors', () => {
      expect(isRateLimitError(rateLimitError)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRateLimitError(networkError)).toBe(false);
      expect(isRateLimitError(regularError)).toBe(false);
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for not found errors', () => {
      expect(isNotFoundError(notFoundError)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isNotFoundError(networkError)).toBe(false);
      expect(isNotFoundError(regularError)).toBe(false);
    });
  });

  describe('isParseError', () => {
    it('should return true for parse errors', () => {
      expect(isParseError(parseError)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isParseError(networkError)).toBe(false);
      expect(isParseError(regularError)).toBe(false);
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for timeout errors', () => {
      expect(isTimeoutError(timeoutError)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isTimeoutError(networkError)).toBe(false);
      expect(isTimeoutError(regularError)).toBe(false);
    });
  });
});
