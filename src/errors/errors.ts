/**
 * Details included with IMSLP errors for debugging
 */
export interface IMSLPErrorDetails {
  /** The URL that was requested */
  url?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Response body snippet for debugging */
  responseBody?: string;
  /** Suggestion for how to fix the error */
  suggestion?: string;
}

/**
 * Base error class for all IMSLP-related errors
 */
export class IMSLPError extends Error {
  public code: string;
  public readonly details: IMSLPErrorDetails;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    details: IMSLPErrorDetails = {},
    cause?: Error
  ) {
    super(message);
    this.name = 'IMSLPError';
    this.code = code;
    this.details = details;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a formatted error message with details
   */
  toDetailedString(): string {
    const parts = [`${this.name}: ${this.message}`, `Code: ${this.code}`];

    if (this.details.url) {
      parts.push(`URL: ${this.details.url}`);
    }
    if (this.details.statusCode) {
      parts.push(`Status: ${this.details.statusCode}`);
    }
    if (this.details.suggestion) {
      parts.push(`Suggestion: ${this.details.suggestion}`);
    }
    if (this.details.responseBody) {
      const truncated =
        this.details.responseBody.length > 200
          ? this.details.responseBody.slice(0, 200) + '...'
          : this.details.responseBody;
      parts.push(`Response: ${truncated}`);
    }

    return parts.join('\n');
  }
}

/**
 * Network-related errors (connection failed, timeout, etc.)
 */
export class NetworkError extends IMSLPError {
  constructor(message: string, details: IMSLPErrorDetails = {}, cause?: Error) {
    super(message, 'NETWORK_ERROR', details, cause);
    this.name = 'NetworkError';
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends IMSLPError {
  public readonly retryAfter?: number;

  constructor(
    message: string,
    details: IMSLPErrorDetails = {},
    retryAfter?: number,
    cause?: Error
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      {
        ...details,
        suggestion:
          details.suggestion ??
          `Wait ${retryAfter ?? 'a few'} seconds before retrying.`,
      },
      cause
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends IMSLPError {
  constructor(message: string, details: IMSLPErrorDetails = {}, cause?: Error) {
    super(
      message,
      'NOT_FOUND',
      {
        ...details,
        suggestion:
          details.suggestion ??
          'Check the slug format. Use findWork() for fuzzy matching.',
      },
      cause
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Error parsing API response or wikitext
 */
export class ParseError extends IMSLPError {
  public readonly rawData?: unknown;

  constructor(
    message: string,
    details: IMSLPErrorDetails = {},
    rawData?: unknown,
    cause?: Error
  ) {
    super(
      message,
      'PARSE_ERROR',
      {
        ...details,
        suggestion:
          details.suggestion ??
          'The IMSLP data format may have changed. Please report this issue.',
      },
      cause
    );
    this.name = 'ParseError';
    this.rawData = rawData;
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends NetworkError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    details: IMSLPErrorDetails = {},
    cause?: Error
  ) {
    super(
      message,
      {
        ...details,
        suggestion:
          details.suggestion ??
          `Request timed out after ${timeoutMs}ms. Try increasing the timeout or check your connection.`,
      },
      cause
    );
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT_ERROR';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Type guard to check if an error is an IMSLP error
 */
export function isIMSLPError(error: unknown): error is IMSLPError {
  return error instanceof IMSLPError;
}

/**
 * Type guard for network errors
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard for rate limit errors
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Type guard for not found errors
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard for parse errors
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Type guard for timeout errors
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
