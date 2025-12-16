/**
 * API Handler Wrapper
 * Provides consistent error handling, logging, and response formatting for Next.js API routes.
 *
 * @module withApiHandler
 * @description This module provides utilities for creating consistent API responses,
 * error handling, and request validation across all API routes.
 *
 * @example
 * ```typescript
 * // Using withApiHandler wrapper
 * export const GET = withApiHandler(async (request, { params, logger }) => {
 *   const data = await fetchData();
 *   return success(data);
 * });
 *
 * // Using withAuth for protected routes
 * export const POST = withAuth(async (request, { user, logger }) => {
 *   // user is guaranteed to be authenticated
 *   return success({ userId: user.id });
 * });
 * ```
 */

import { NextResponse } from 'next/server';
import { createLogger, Logger, generateRequestId } from './logger';
import { VALIDATION_LIMITS, checkBodySizeLimit } from './validation';

/**
 * Standard success response structure
 * @template T - The type of data returned
 */
export interface ApiSuccess<T = unknown> {
  /** Always true for success responses */
  success: true;
  /** The response data */
  data: T;
  /** Unique request identifier for tracing */
  requestId?: string;
}

/**
 * Standard error response structure
 */
export interface ApiError {
  /** Always false for error responses */
  success: false;
  /** Error details */
  error: {
    /** Machine-readable error code (e.g., 'UNAUTHORIZED', 'NOT_FOUND') */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error context */
    details?: Record<string, unknown>;
  };
  /** Unique request identifier for tracing */
  requestId?: string;
}

/**
 * Union type for all API responses
 * @template T - The type of data returned on success
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Route params type for Next.js App Router */
export type RouteParams = { params: Promise<Record<string, string>> };

/**
 * API handler function signature
 * @template T - The type of data returned on success
 */
export type ApiHandler<T = unknown> = (
  request: Request,
  context: {
    /** Resolved route parameters */
    params: Record<string, string>;
    /** Request-scoped logger instance */
    logger: Logger;
  }
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Custom error class for API errors.
 * Provides structured error information that gets converted to ApiError responses.
 *
 * @example
 * ```typescript
 * // Using factory methods (recommended)
 * throw ApiException.notFound('User not found');
 * throw ApiException.badRequest('Invalid email format', 'INVALID_EMAIL');
 *
 * // Using constructor directly
 * throw new ApiException('CUSTOM_ERROR', 'Something went wrong', 400);
 * ```
 */
export class ApiException extends Error {
  /** Machine-readable error code */
  public readonly code: string;
  /** HTTP status code */
  public readonly statusCode: number;
  /** Additional error context */
  public readonly details?: Record<string, unknown>;

  /**
   * Create a new ApiException
   * @param code - Machine-readable error code
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 500)
   * @param details - Additional error context
   */
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

  /**
   * Create a 400 Bad Request error
   * @param message - Error message
   * @param code - Error code (default: 'BAD_REQUEST')
   * @param details - Additional context
   */
  static badRequest(message: string, code: string = 'BAD_REQUEST', details?: Record<string, unknown>): ApiException {
    return new ApiException(code, message, 400, details);
  }

  /**
   * Create a 401 Unauthorized error
   * @param message - Error message (default: 'Not authenticated')
   */
  static unauthorized(message: string = 'Not authenticated'): ApiException {
    return new ApiException('UNAUTHORIZED', message, 401);
  }

  /**
   * Create a 403 Forbidden error
   * @param message - Error message (default: 'Access denied')
   */
  static forbidden(message: string = 'Access denied'): ApiException {
    return new ApiException('FORBIDDEN', message, 403);
  }

  /**
   * Create a 404 Not Found error
   * @param message - Error message
   * @param resource - Resource type for default message (default: 'Resource')
   */
  static notFound(message: string, resource: string = 'Resource'): ApiException {
    return new ApiException('NOT_FOUND', message || `${resource} not found`, 404);
  }

  /**
   * Create a 409 Conflict error
   * @param message - Error message
   * @param code - Error code (default: 'CONFLICT')
   */
  static conflict(message: string, code: string = 'CONFLICT'): ApiException {
    return new ApiException(code, message, 409);
  }

  /**
   * Create a 500 Internal Server Error
   * @param message - Error message (default: 'Internal server error')
   */
  static internal(message: string = 'Internal server error'): ApiException {
    return new ApiException('INTERNAL_ERROR', message, 500);
  }
}

/**
 * Create a standardized success response
 * @template T - The type of data being returned
 * @param data - The response data
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with success structure
 *
 * @example
 * ```typescript
 * return success({ users: [], total: 0 });
 * return success({ id: 'abc123' }, requestId);
 * ```
 */
export function success<T>(data: T, requestId?: string): NextResponse<ApiSuccess<T>> {
  const response: ApiSuccess<T> = { success: true, data };
  if (requestId) response.requestId = requestId;
  return NextResponse.json(response);
}

/**
 * Create a standardized error response
 * @param code - Machine-readable error code
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Additional error context
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with error structure
 *
 * @example
 * ```typescript
 * return error('NOT_FOUND', 'User not found', 404);
 * return error('VALIDATION_ERROR', 'Invalid input', 400, { field: 'email' });
 * ```
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
 * Options for the withApiHandler wrapper
 */
export interface ApiHandlerOptions {
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize?: number;
  /** Skip body size check (for streaming or file uploads) */
  skipBodySizeCheck?: boolean;
}

/**
 * Wrap an API handler with automatic error handling, logging, and request ID tracking.
 *
 * Features:
 * - Automatic request ID generation and response headers
 * - Request body size validation
 * - Converts ApiException to proper error responses
 * - Logs all requests with duration
 * - Hides internal error details in production
 *
 * @template T - The type of data returned on success
 * @param handler - The API handler function
 * @param options - Optional configuration
 * @returns Wrapped handler function
 *
 * @example
 * ```typescript
 * export const GET = withApiHandler(async (request, { params, logger }) => {
 *   logger.info('Fetching users');
 *   const users = await getUsers();
 *   return success(users);
 * });
 *
 * export const POST = withApiHandler(async (request, { params, logger }) => {
 *   const body = await parseBody(request, ['name', 'email']);
 *   const user = await createUser(body);
 *   return success(user);
 * }, { maxBodySize: 1024 * 100 }); // 100KB limit
 * ```
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
 * Extract and validate a required route parameter
 * @param params - Route parameters object
 * @param key - Parameter name to extract
 * @returns The parameter value
 * @throws ApiException if parameter is missing
 *
 * @example
 * ```typescript
 * const id = getParam(params, 'id'); // throws if missing
 * ```
 */
export function getParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) {
    throw ApiException.badRequest(`Missing required parameter: ${key}`, 'MISSING_PARAM');
  }
  return value;
}

/**
 * Options for the parseBody helper
 */
export interface ParseBodyOptions {
  /** Required fields that must be present in the body */
  requiredFields?: string[];
  /** Maximum body size in bytes (checked before parsing) */
  maxSize?: number;
}

/**
 * Parse and validate JSON request body
 * @template T - Expected body type
 * @param request - The incoming request
 * @param options - Validation options or array of required field names
 * @returns Parsed body
 * @throws ApiException if body is invalid JSON or missing required fields
 *
 * @example
 * ```typescript
 * // With required fields array (legacy)
 * const body = await parseBody(request, ['name', 'email']);
 *
 * // With options object
 * const body = await parseBody<CreateUserInput>(request, {
 *   requiredFields: ['name', 'email'],
 *   maxSize: 1024 * 10, // 10KB
 * });
 * ```
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
