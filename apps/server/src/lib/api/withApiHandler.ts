/**
 * API Handler Wrapper
 * Provides consistent error handling, logging, and response formatting
 */

import { NextResponse } from 'next/server';
import { createLogger, Logger, generateRequestId } from './logger';
import { VALIDATION_LIMITS, checkBodySizeLimit } from './validation';

// Standard API response types
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Handler types
export type RouteParams = { params: Promise<Record<string, string>> };

export type ApiHandler<T = unknown> = (
  request: Request,
  context: {
    params: Record<string, string>;
    logger: Logger;
  }
) => Promise<NextResponse<ApiResponse<T>>>;

// Error class for API errors
export class ApiException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  // Factory methods for common errors
  static badRequest(message: string, code: string = 'BAD_REQUEST', details?: Record<string, unknown>): ApiException {
    return new ApiException(code, message, 400, details);
  }

  static unauthorized(message: string = 'Not authenticated'): ApiException {
    return new ApiException('UNAUTHORIZED', message, 401);
  }

  static forbidden(message: string = 'Access denied'): ApiException {
    return new ApiException('FORBIDDEN', message, 403);
  }

  static notFound(message: string, resource: string = 'Resource'): ApiException {
    return new ApiException('NOT_FOUND', message || `${resource} not found`, 404);
  }

  static conflict(message: string, code: string = 'CONFLICT'): ApiException {
    return new ApiException(code, message, 409);
  }

  static internal(message: string = 'Internal server error'): ApiException {
    return new ApiException('INTERNAL_ERROR', message, 500);
  }
}

/**
 * Create a success response
 */
export function success<T>(data: T, requestId?: string): NextResponse<ApiSuccess<T>> {
  const response: ApiSuccess<T> = { success: true, data };
  if (requestId) response.requestId = requestId;
  return NextResponse.json(response);
}

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
  requestId?: string
): NextResponse<ApiError> {
  const response: ApiError = {
    success: false,
    error: { code, message, details },
  };
  if (requestId) response.requestId = requestId;
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Options for API handler wrapper
 */
export interface ApiHandlerOptions {
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize?: number;
  /** Skip body size check (for streaming or file uploads) */
  skipBodySizeCheck?: boolean;
}

/**
 * Wrap an API handler with error handling and logging
 */
export function withApiHandler<T = unknown>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions = {}
) {
  return async (
    request: Request,
    routeParams?: RouteParams
  ): Promise<NextResponse<ApiResponse<T>>> => {
    const requestId = generateRequestId();
    const logger = createLogger(request);
    const startTime = Date.now();

    try {
      // Check body size limit for non-GET/HEAD requests
      if (!options.skipBodySizeCheck && !['GET', 'HEAD'].includes(request.method)) {
        const maxSize = options.maxBodySize ?? VALIDATION_LIMITS.DEFAULT_BODY_SIZE_LIMIT;
        checkBodySizeLimit(request, maxSize);
      }

      // Resolve params if provided
      const params = routeParams?.params ? await routeParams.params : {};

      // Execute handler
      const result = await handler(request, { params, logger });

      // Add request ID to response headers
      result.headers.set('X-Request-Id', requestId);

      // Log successful completion
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        statusCode: result.status,
        duration,
      });

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;

      if (err instanceof ApiException) {
        // Known API errors
        logger.warn(`API Error: ${err.code}`, {
          statusCode: err.statusCode,
          duration,
          error: err.message,
        });

        const response = error(
          err.code,
          err.message,
          err.statusCode,
          err.details,
          requestId
        );
        response.headers.set('X-Request-Id', requestId);
        return response as NextResponse<ApiResponse<T>>;
      }

      // Unknown errors
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error('Unhandled error', errorObj, { duration });

      const response = error(
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : errorObj.message,
        500,
        undefined,
        requestId
      );
      response.headers.set('X-Request-Id', requestId);
      return response as NextResponse<ApiResponse<T>>;
    }
  };
}

/**
 * Helper to extract validated params
 */
export function getParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) {
    throw ApiException.badRequest(`Missing required parameter: ${key}`, 'MISSING_PARAM');
  }
  return value;
}

/**
 * Options for parseBody
 */
export interface ParseBodyOptions {
  /** Required fields that must be present */
  requiredFields?: string[];
  /** Maximum body size in bytes (checked before parsing) */
  maxSize?: number;
}

/**
 * Helper to parse JSON body with validation
 */
export async function parseBody<T = Record<string, unknown>>(
  request: Request,
  options?: ParseBodyOptions | string[]
): Promise<T> {
  // Handle legacy API where second param was just requiredFields array
  const opts: ParseBodyOptions = Array.isArray(options)
    ? { requiredFields: options }
    : options || {};

  try {
    // Check content length before parsing
    if (opts.maxSize) {
      checkBodySizeLimit(request, opts.maxSize);
    }

    const body = await request.json() as T;

    if (opts.requiredFields && typeof body === 'object' && body !== null) {
      const missing = opts.requiredFields.filter(
        (field) => !(field in (body as Record<string, unknown>))
      );
      if (missing.length > 0) {
        throw ApiException.badRequest(
          `Missing required fields: ${missing.join(', ')}`,
          'VALIDATION_ERROR',
          { missing }
        );
      }
    }

    return body;
  } catch (err) {
    if (err instanceof ApiException) throw err;
    throw ApiException.badRequest('Invalid JSON body', 'INVALID_JSON');
  }
}
