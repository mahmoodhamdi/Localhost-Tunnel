import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rateLimiter,
  RATE_LIMITS,
  getClientIp,
  createRateLimitKey,
} from '../../src/lib/api/rateLimiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear any existing entries
    rateLimiter.clear('test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('check', () => {
    it('should allow first request', () => {
      const result = rateLimiter.check('new-key-1', {
        windowMs: 60000,
        maxRequests: 10,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      rateLimiter.clear('new-key-1');
    });

    it('should decrement remaining count', () => {
      const key = 'decrement-test';
      const config = { windowMs: 60000, maxRequests: 5 };

      rateLimiter.check(key, config);
      const result = rateLimiter.check(key, config);

      expect(result.remaining).toBe(3);
      rateLimiter.clear(key);
    });

    it('should deny requests after limit reached', () => {
      const key = 'limit-test';
      const config = { windowMs: 60000, maxRequests: 2 };

      rateLimiter.check(key, config);
      rateLimiter.check(key, config);
      const result = rateLimiter.check(key, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      rateLimiter.clear(key);
    });

    it('should reset after window expires', async () => {
      vi.useFakeTimers();
      const key = 'window-test';
      const config = { windowMs: 1000, maxRequests: 2 };

      rateLimiter.check(key, config);
      rateLimiter.check(key, config);

      // Advance time past window
      vi.advanceTimersByTime(1001);

      const result = rateLimiter.check(key, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);

      vi.useRealTimers();
      rateLimiter.clear(key);
    });

    it('should return correct reset time', () => {
      const now = Date.now();
      const key = 'reset-time-test';
      const config = { windowMs: 60000, maxRequests: 10 };

      const result = rateLimiter.check(key, config);

      expect(result.resetTime).toBeGreaterThanOrEqual(now + 60000);
      rateLimiter.clear(key);
    });

    it('should track different keys independently', () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      rateLimiter.check('key-a', config);
      rateLimiter.check('key-a', config);
      const resultA = rateLimiter.check('key-a', config);

      const resultB = rateLimiter.check('key-b', config);

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);

      rateLimiter.clear('key-a');
      rateLimiter.clear('key-b');
    });
  });

  describe('clear', () => {
    it('should clear rate limit for key', () => {
      const key = 'clear-test';
      const config = { windowMs: 60000, maxRequests: 2 };

      rateLimiter.check(key, config);
      rateLimiter.check(key, config);
      rateLimiter.clear(key);

      const result = rateLimiter.check(key, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);

      rateLimiter.clear(key);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have correct UPLOAD config', () => {
      expect(RATE_LIMITS.UPLOAD.windowMs).toBe(60000);
      expect(RATE_LIMITS.UPLOAD.maxRequests).toBe(10);
    });

    it('should have correct REGISTER config', () => {
      expect(RATE_LIMITS.REGISTER.windowMs).toBe(3600000);
      expect(RATE_LIMITS.REGISTER.maxRequests).toBe(5);
    });

    it('should have correct PASSWORD_RESET config', () => {
      expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBe(3600000);
      expect(RATE_LIMITS.PASSWORD_RESET.maxRequests).toBe(3);
    });

    it('should have correct API_KEY_CREATE config', () => {
      expect(RATE_LIMITS.API_KEY_CREATE.windowMs).toBe(3600000);
      expect(RATE_LIMITS.API_KEY_CREATE.maxRequests).toBe(10);
    });

    it('should have correct TEAM_CREATE config', () => {
      expect(RATE_LIMITS.TEAM_CREATE.windowMs).toBe(3600000);
      expect(RATE_LIMITS.TEAM_CREATE.maxRequests).toBe(10);
    });

    it('should have correct WRITE config', () => {
      expect(RATE_LIMITS.WRITE.windowMs).toBe(60000);
      expect(RATE_LIMITS.WRITE.maxRequests).toBe(60);
    });
  });
});

describe('getClientIp', () => {
  it('should return x-forwarded-for header', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '192.168.1.1',
      }),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('should return first IP from x-forwarded-for chain', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
      }),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('should trim whitespace from IP', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '  192.168.1.1  ',
      }),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('should return x-real-ip when x-forwarded-for is missing', () => {
    const request = {
      headers: new Headers({
        'x-real-ip': '10.0.0.5',
      }),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('10.0.0.5');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '10.0.0.5',
      }),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('should return unknown when no IP headers present', () => {
    const request = {
      headers: new Headers(),
    } as unknown as Request;

    expect(getClientIp(request)).toBe('unknown');
  });
});

describe('createRateLimitKey', () => {
  it('should create key with user ID', () => {
    const key = createRateLimitKey('upload', 'user-123');
    expect(key).toBe('upload:user-123');
  });

  it('should create key with IP when user ID is null', () => {
    const key = createRateLimitKey('upload', null, '192.168.1.1');
    expect(key).toBe('upload:192.168.1.1');
  });

  it('should create key with IP when user ID is undefined', () => {
    const key = createRateLimitKey('register', undefined, '10.0.0.1');
    expect(key).toBe('register:10.0.0.1');
  });

  it('should create anonymous key when no identifier provided', () => {
    const key = createRateLimitKey('action');
    expect(key).toBe('action:anonymous');
  });

  it('should prefer user ID over IP', () => {
    const key = createRateLimitKey('action', 'user-456', '192.168.1.1');
    expect(key).toBe('action:user-456');
  });
});
