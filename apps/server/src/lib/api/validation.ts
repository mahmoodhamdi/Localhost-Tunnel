/**
 * Input Validation Utilities
 * Provides common validation functions for API routes
 */

import { ApiException } from './withApiHandler';

// Validation constraints
export const VALIDATION_LIMITS = {
  // String field max lengths
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_EMAIL_LENGTH: 255,
  MAX_PASSWORD_LENGTH: 128,
  MAX_SUBDOMAIN_LENGTH: 63,
  MAX_IP_WHITELIST_LENGTH: 1000,
  MAX_URL_LENGTH: 2048,

  // Request body size limits
  DEFAULT_BODY_SIZE_LIMIT: 1024 * 1024, // 1MB default
  MAX_BODY_SIZE_LIMIT: 10 * 1024 * 1024, // 10MB maximum

  // Numeric limits
  MIN_PORT: 1,
  MAX_PORT: 65535,
  MIN_PASSWORD_LENGTH: 8,
  MAX_EXPIRES_IN: 365 * 24 * 60 * 60, // 1 year in seconds
};

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate port number
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) &&
    port >= VALIDATION_LIMITS.MIN_PORT &&
    port <= VALIDATION_LIMITS.MAX_PORT;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string | null | undefined,
  maxLength: number,
  minLength: number = 0
): boolean {
  if (value === null || value === undefined) return minLength === 0;
  return value.length >= minLength && value.length <= maxLength;
}

/**
 * Sanitize string input (trim and remove control characters)
 */
export function sanitizeString(value: string): string {
  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  return value.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validate and sanitize a required string field
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number = VALIDATION_LIMITS.MAX_NAME_LENGTH
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw ApiException.badRequest(`${fieldName} is required`, 'VALIDATION_ERROR');
  }

  const sanitized = sanitizeString(value);

  if (sanitized.length > maxLength) {
    throw ApiException.badRequest(
      `${fieldName} must be at most ${maxLength} characters`,
      'VALIDATION_ERROR'
    );
  }

  return sanitized;
}

/**
 * Validate and sanitize an optional string field
 */
export function validateOptionalString(
  value: unknown,
  fieldName: string,
  maxLength: number = VALIDATION_LIMITS.MAX_NAME_LENGTH
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw ApiException.badRequest(`${fieldName} must be a string`, 'VALIDATION_ERROR');
  }

  const sanitized = sanitizeString(value);

  if (sanitized.length > maxLength) {
    throw ApiException.badRequest(
      `${fieldName} must be at most ${maxLength} characters`,
      'VALIDATION_ERROR'
    );
  }

  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Validate email input
 */
export function validateEmailInput(value: unknown): string {
  if (typeof value !== 'string') {
    throw ApiException.badRequest('Email is required', 'VALIDATION_ERROR');
  }

  const email = value.trim().toLowerCase();

  if (!validateEmail(email)) {
    throw ApiException.badRequest('Invalid email format', 'VALIDATION_ERROR');
  }

  if (email.length > VALIDATION_LIMITS.MAX_EMAIL_LENGTH) {
    throw ApiException.badRequest(
      `Email must be at most ${VALIDATION_LIMITS.MAX_EMAIL_LENGTH} characters`,
      'VALIDATION_ERROR'
    );
  }

  return email;
}

/**
 * Validate password input
 */
export function validatePasswordInput(value: unknown, fieldName: string = 'Password'): string {
  if (typeof value !== 'string') {
    throw ApiException.badRequest(`${fieldName} is required`, 'VALIDATION_ERROR');
  }

  if (value.length < VALIDATION_LIMITS.MIN_PASSWORD_LENGTH) {
    throw ApiException.badRequest(
      `${fieldName} must be at least ${VALIDATION_LIMITS.MIN_PASSWORD_LENGTH} characters`,
      'VALIDATION_ERROR'
    );
  }

  if (value.length > VALIDATION_LIMITS.MAX_PASSWORD_LENGTH) {
    throw ApiException.badRequest(
      `${fieldName} must be at most ${VALIDATION_LIMITS.MAX_PASSWORD_LENGTH} characters`,
      'VALIDATION_ERROR'
    );
  }

  return value;
}

/**
 * Validate port input
 */
export function validatePortInput(value: unknown): number {
  const port = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof port !== 'number' || !validatePort(port)) {
    throw ApiException.badRequest(
      `Port must be a number between ${VALIDATION_LIMITS.MIN_PORT} and ${VALIDATION_LIMITS.MAX_PORT}`,
      'INVALID_PORT'
    );
  }

  return port;
}

/**
 * Validate expiration time input (in seconds)
 */
export function validateExpiresIn(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const expiresIn = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof expiresIn !== 'number' || expiresIn <= 0) {
    throw ApiException.badRequest('Expiration time must be a positive number', 'VALIDATION_ERROR');
  }

  if (expiresIn > VALIDATION_LIMITS.MAX_EXPIRES_IN) {
    throw ApiException.badRequest(
      'Expiration time cannot exceed 1 year',
      'VALIDATION_ERROR'
    );
  }

  return expiresIn;
}

/**
 * Validate boolean input
 */
export function validateBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }

  return defaultValue;
}

/**
 * Validate UUID format
 */
export function validateUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate UUID input
 */
export function validateUUIDInput(value: unknown, fieldName: string = 'ID'): string {
  if (typeof value !== 'string' || !validateUUID(value)) {
    throw ApiException.badRequest(`Invalid ${fieldName} format`, 'VALIDATION_ERROR');
  }
  return value;
}

/**
 * Get request content length
 */
export function getContentLength(request: Request): number | null {
  const contentLength = request.headers.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : null;
}

/**
 * Check if request body size exceeds limit
 */
export function checkBodySizeLimit(
  request: Request,
  maxSize: number = VALIDATION_LIMITS.DEFAULT_BODY_SIZE_LIMIT
): void {
  const contentLength = getContentLength(request);

  if (contentLength !== null && contentLength > maxSize) {
    throw ApiException.badRequest(
      `Request body too large. Maximum size is ${Math.round(maxSize / 1024)}KB`,
      'PAYLOAD_TOO_LARGE'
    );
  }
}
