import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRequestId,
  createRequestContext,
  Logger,
  createLogger,
  log,
  systemLogger,
} from '../../src/lib/api/logger';

describe('Logger Utilities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate a UUID', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('createRequestContext', () => {
    it('should create context from request', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'TestAgent/1.0',
        }),
      } as unknown as Request;

      const context = createRequestContext(mockRequest);

      expect(context.method).toBe('GET');
      expect(context.path).toBe('/api/test');
      expect(context.ip).toBe('192.168.1.1');
      expect(context.userAgent).toBe('TestAgent/1.0');
      expect(context.requestId).toBeDefined();
      expect(context.startTime).toBeDefined();
    });

    it('should handle x-real-ip header', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'POST',
        headers: new Headers({
          'x-real-ip': '10.0.0.1',
        }),
      } as unknown as Request;

      const context = createRequestContext(mockRequest);
      expect(context.ip).toBe('10.0.0.1');
    });

    it('should handle missing IP headers', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as unknown as Request;

      const context = createRequestContext(mockRequest);
      expect(context.ip).toBe('unknown');
    });

    it('should handle comma-separated x-forwarded-for', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        }),
      } as unknown as Request;

      const context = createRequestContext(mockRequest);
      expect(context.ip).toBe('192.168.1.1');
    });

    it('should include userId when provided', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as unknown as Request;

      const context = createRequestContext(mockRequest, 'user-123');
      expect(context.userId).toBe('user-123');
    });
  });

  describe('Logger', () => {
    let logger: Logger;
    let mockContext: Parameters<typeof Logger['prototype']['constructor']>[0];

    beforeEach(() => {
      mockContext = {
        requestId: 'test-req-id',
        startTime: Date.now(),
        method: 'GET',
        path: '/api/test',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };
      logger = new Logger(mockContext);
    });

    it('should log info messages', () => {
      logger.info('Test message');
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(console.error).toHaveBeenCalled();
    });

    it('should log debug in development', () => {
      logger.debug('Debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log complete with status code', () => {
      logger.complete(200);
      expect(console.info).toHaveBeenCalled();
    });

    it('should log complete with 4xx as warn', () => {
      logger.complete(404);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log complete with 5xx as error', () => {
      logger.complete(500);
      expect(console.error).toHaveBeenCalled();
    });

    it('should return request ID', () => {
      expect(logger.getRequestId()).toBe('test-req-id');
    });

    it('should return duration', () => {
      const duration = logger.getDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata in log', () => {
      logger.info('Test', { key: 'value' });
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('createLogger', () => {
    it('should create a logger from request', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as unknown as Request;

      const logger = createLogger(mockRequest);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with userId', () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as unknown as Request;

      const logger = createLogger(mockRequest, 'user-456');
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log function', () => {
    it('should log info level', () => {
      log('info', 'Info message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log with metadata', () => {
      log('warn', 'Warning', { extra: 'data' });
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('systemLogger', () => {
    it('should log info', () => {
      systemLogger.info('System info');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log warn', () => {
      systemLogger.warn('System warning');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log error', () => {
      systemLogger.error('System error');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      systemLogger.error('Error occurred', error);
      expect(console.log).toHaveBeenCalled();
    });

    it('should log error with non-Error value', () => {
      systemLogger.error('Error occurred', 'string error');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log debug in development', () => {
      systemLogger.debug('Debug message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should include metadata', () => {
      systemLogger.info('Message', { key: 'value' });
      expect(console.log).toHaveBeenCalled();
    });
  });
});
