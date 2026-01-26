import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
  ApiException,
  success,
  error,
  withApiHandler,
  getParam,
  parseBody,
} from '../../src/lib/api/withApiHandler';

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      data,
      status: options?.status || 200,
      headers: new Map(),
    })),
  },
}));

// Mock logger
vi.mock('../../src/lib/api/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateRequestId: () => 'test-request-id-123',
}));

describe('withApiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiException', () => {
    it('should create an ApiException with default values', () => {
      const exception = new ApiException('TEST_CODE', 'Test message');
      expect(exception.code).toBe('TEST_CODE');
      expect(exception.message).toBe('Test message');
      expect(exception.statusCode).toBe(500);
      expect(exception.details).toBeUndefined();
    });

    it('should create an ApiException with custom values', () => {
      const details = { field: 'email' };
      const exception = new ApiException('CUSTOM', 'Custom error', 422, details);
      expect(exception.code).toBe('CUSTOM');
      expect(exception.message).toBe('Custom error');
      expect(exception.statusCode).toBe(422);
      expect(exception.details).toEqual(details);
    });

    it('should create badRequest exception', () => {
      const exception = ApiException.badRequest('Bad input');
      expect(exception.statusCode).toBe(400);
      expect(exception.code).toBe('BAD_REQUEST');
      expect(exception.message).toBe('Bad input');
    });

    it('should create badRequest with custom code', () => {
      const exception = ApiException.badRequest('Invalid', 'CUSTOM_CODE');
      expect(exception.code).toBe('CUSTOM_CODE');
    });

    it('should create badRequest with details', () => {
      const details = { field: 'name' };
      const exception = ApiException.badRequest('Invalid', 'BAD_REQUEST', details);
      expect(exception.details).toEqual(details);
    });

    it('should create unauthorized exception', () => {
      const exception = ApiException.unauthorized();
      expect(exception.statusCode).toBe(401);
      expect(exception.code).toBe('UNAUTHORIZED');
      expect(exception.message).toBe('Not authenticated');
    });

    it('should create unauthorized with custom message', () => {
      const exception = ApiException.unauthorized('Token expired');
      expect(exception.message).toBe('Token expired');
    });

    it('should create forbidden exception', () => {
      const exception = ApiException.forbidden();
      expect(exception.statusCode).toBe(403);
      expect(exception.code).toBe('FORBIDDEN');
      expect(exception.message).toBe('Access denied');
    });

    it('should create forbidden with custom message', () => {
      const exception = ApiException.forbidden('Not allowed');
      expect(exception.message).toBe('Not allowed');
    });

    it('should create notFound exception', () => {
      const exception = ApiException.notFound('User not found');
      expect(exception.statusCode).toBe(404);
      expect(exception.code).toBe('NOT_FOUND');
      expect(exception.message).toBe('User not found');
    });

    it('should create notFound with resource type', () => {
      const exception = ApiException.notFound('', 'User');
      expect(exception.message).toBe('User not found');
    });

    it('should create conflict exception', () => {
      const exception = ApiException.conflict('Already exists');
      expect(exception.statusCode).toBe(409);
      expect(exception.code).toBe('CONFLICT');
      expect(exception.message).toBe('Already exists');
    });

    it('should create conflict with custom code', () => {
      const exception = ApiException.conflict('Duplicate', 'DUPLICATE_ENTRY');
      expect(exception.code).toBe('DUPLICATE_ENTRY');
    });

    it('should create internal exception', () => {
      const exception = ApiException.internal();
      expect(exception.statusCode).toBe(500);
      expect(exception.code).toBe('INTERNAL_ERROR');
      expect(exception.message).toBe('Internal server error');
    });

    it('should create internal with custom message', () => {
      const exception = ApiException.internal('Database connection failed');
      expect(exception.message).toBe('Database connection failed');
    });
  });

  describe('success', () => {
    it('should create a success response', () => {
      const data = { id: 1, name: 'Test' };
      const result = success(data);
      expect(result.data).toEqual({ success: true, data });
    });

    it('should include requestId when provided', () => {
      const data = { id: 1 };
      const result = success(data, 'req-123');
      expect(result.data).toEqual({ success: true, data, requestId: 'req-123' });
    });

    it('should handle null data', () => {
      const result = success(null);
      expect(result.data).toEqual({ success: true, data: null });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const result = success(data);
      expect(result.data).toEqual({ success: true, data: [1, 2, 3] });
    });
  });

  describe('error', () => {
    it('should create an error response with defaults', () => {
      const result = error('ERROR_CODE', 'Error message');
      expect(result.data.success).toBe(false);
      expect(result.data.error.code).toBe('ERROR_CODE');
      expect(result.data.error.message).toBe('Error message');
      expect(result.status).toBe(500);
    });

    it('should create an error response with custom status', () => {
      const result = error('NOT_FOUND', 'Not found', 404);
      expect(result.status).toBe(404);
    });

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid' };
      const result = error('VALIDATION', 'Invalid', 400, details);
      expect(result.data.error.details).toEqual(details);
    });

    it('should include requestId when provided', () => {
      const result = error('ERROR', 'Message', 500, undefined, 'req-456');
      expect(result.data.requestId).toBe('req-456');
    });
  });

  describe('getParam', () => {
    it('should return param value when present', () => {
      const params = { id: '123', name: 'test' };
      expect(getParam(params, 'id')).toBe('123');
      expect(getParam(params, 'name')).toBe('test');
    });

    it('should throw ApiException when param is missing', () => {
      const params = { id: '123' };
      expect(() => getParam(params, 'name')).toThrow(ApiException);
    });

    it('should throw with correct error code', () => {
      const params = {};
      try {
        getParam(params, 'id');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiException);
        expect((err as ApiException).code).toBe('MISSING_PARAM');
      }
    });
  });

  describe('parseBody', () => {
    it('should parse valid JSON body', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ name: 'Test', email: 'test@example.com' }),
        headers: new Headers(),
      } as unknown as Request;

      const result = await parseBody(mockRequest);
      expect(result).toEqual({ name: 'Test', email: 'test@example.com' });
    });

    it('should validate required fields', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ name: 'Test' }),
        headers: new Headers(),
      } as unknown as Request;

      await expect(parseBody(mockRequest, ['name', 'email']))
        .rejects.toThrow(ApiException);
    });

    it('should pass when all required fields present', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ name: 'Test', email: 'test@example.com' }),
        headers: new Headers(),
      } as unknown as Request;

      const result = await parseBody(mockRequest, ['name', 'email']);
      expect(result).toEqual({ name: 'Test', email: 'test@example.com' });
    });

    it('should handle ParseBodyOptions object', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ name: 'Test' }),
        headers: new Headers(),
      } as unknown as Request;

      await expect(parseBody(mockRequest, { requiredFields: ['email'] }))
        .rejects.toThrow(ApiException);
    });

    it('should throw for invalid JSON', async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: new Headers(),
      } as unknown as Request;

      await expect(parseBody(mockRequest)).rejects.toThrow(ApiException);
    });

    it('should include missing fields in error details', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({}),
        headers: new Headers(),
      } as unknown as Request;

      try {
        await parseBody(mockRequest, ['field1', 'field2']);
      } catch (err) {
        expect((err as ApiException).details?.missing).toContain('field1');
        expect((err as ApiException).details?.missing).toContain('field2');
      }
    });
  });

  describe('withApiHandler wrapper', () => {
    it('should execute handler and return result', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockResolvedValue({
        data: { success: true, data: { id: 1 } },
        status: 200,
        headers: new Map(),
      });

      const wrappedHandler = withApiHandler(handler);
      const result = await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalled();
      expect(result.headers.get('X-Request-Id')).toBe('test-request-id-123');
    });

    it('should handle ApiException and return error response', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockRejectedValue(
        ApiException.notFound('Resource not found')
      );

      const wrappedHandler = withApiHandler(handler);
      const result = await wrappedHandler(mockRequest);

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
    });

    it('should handle unknown errors', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockRejectedValue(new Error('Unknown error'));

      const wrappedHandler = withApiHandler(handler);
      const result = await wrappedHandler(mockRequest);

      expect(result.status).toBe(500);
      expect(result.data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle non-Error throws', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockRejectedValue('string error');

      const wrappedHandler = withApiHandler(handler);
      const result = await wrappedHandler(mockRequest);

      expect(result.status).toBe(500);
    });

    it('should resolve route params', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockImplementation(async (_req, { params }) => ({
        data: { success: true, data: params },
        status: 200,
        headers: new Map(),
      }));

      const wrappedHandler = withApiHandler(handler);
      await wrappedHandler(mockRequest, {
        params: Promise.resolve({ id: '123' }),
      });

      expect(handler).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({ params: { id: '123' } })
      );
    });

    it('should handle missing route params', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockImplementation(async (_req, { params }) => ({
        data: { success: true, data: params },
        status: 200,
        headers: new Map(),
      }));

      const wrappedHandler = withApiHandler(handler);
      await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({ params: {} })
      );
    });

    it('should skip body size check for GET requests', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockResolvedValue({
        data: { success: true, data: {} },
        status: 200,
        headers: new Map(),
      });

      const wrappedHandler = withApiHandler(handler);
      await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalled();
    });

    it('should skip body size check for HEAD requests', async () => {
      const mockRequest = {
        method: 'HEAD',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockResolvedValue({
        data: { success: true, data: {} },
        status: 200,
        headers: new Map(),
      });

      const wrappedHandler = withApiHandler(handler);
      await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalled();
    });

    it('should skip body size check when option is set', async () => {
      const mockRequest = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers: new Headers(),
      } as unknown as Request;

      const handler = vi.fn().mockResolvedValue({
        data: { success: true, data: {} },
        status: 200,
        headers: new Map(),
      });

      const wrappedHandler = withApiHandler(handler, { skipBodySizeCheck: true });
      await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalled();
    });
  });
});
