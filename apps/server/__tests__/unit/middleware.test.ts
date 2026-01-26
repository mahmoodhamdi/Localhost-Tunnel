import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mock next-intl
vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => vi.fn((request: NextRequest) => {
    return new NextResponse(null, { status: 200 });
  })),
}));

vi.mock('../../src/i18n/routing', () => ({
  routing: {
    locales: ['en', 'ar'],
    defaultLocale: 'en',
  },
}));

// Import after mocks
import middleware, { config } from '../../src/middleware';

describe('Middleware', () => {
  const createMockRequest = (options: {
    url: string;
    method?: string;
    origin?: string;
    cookies?: Record<string, string>;
  }): NextRequest => {
    const url = new URL(options.url, 'http://localhost:3000');
    const headers = new Headers();
    if (options.origin) {
      headers.set('origin', options.origin);
    }

    const cookies = {
      get: (name: string) => options.cookies?.[name] ? { value: options.cookies[name] } : undefined,
    };

    return {
      url: url.toString(),
      nextUrl: url,
      method: options.method || 'GET',
      headers,
      cookies,
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('config', () => {
    it('should have correct matcher patterns', () => {
      expect(config.matcher).toContain('/');
      expect(config.matcher).toContain('/(ar|en)/:path*');
      expect(config.matcher).toContain('/api/:path*');
    });
  });

  describe('API Routes', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const request = createMockRequest({
        url: '/api/test',
        method: 'OPTIONS',
        origin: 'http://localhost:3000',
      });

      const response = await middleware(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should add CORS headers to API requests', async () => {
      const request = createMockRequest({
        url: '/api/test',
        method: 'GET',
        origin: 'http://localhost:3000',
      });

      const response = await middleware(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });

    it('should add security headers to API requests', async () => {
      const request = createMockRequest({
        url: '/api/tunnels',
        method: 'GET',
      });

      const response = await middleware(request);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('Page Routes', () => {
    it('should handle non-API routes', async () => {
      const request = createMockRequest({
        url: '/en/dashboard',
      });

      const response = await middleware(request);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should add security headers to page routes', async () => {
      const request = createMockRequest({
        url: '/en/settings',
      });

      const response = await middleware(request);

      expect(response.headers.get('Strict-Transport-Security')).toBeDefined();
      expect(response.headers.get('Permissions-Policy')).toBeDefined();
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users from protected routes', async () => {
      const request = createMockRequest({
        url: '/en/settings/api-keys',
        cookies: {},
      });

      const response = await middleware(request);

      // Should redirect to login
      expect(response.status).toBe(307);
    });

    it('should allow authenticated users to access protected routes', async () => {
      const request = createMockRequest({
        url: '/en/settings/api-keys',
        cookies: {
          'authjs.session-token': 'valid-token',
        },
      });

      const response = await middleware(request);

      // Should not redirect
      expect(response.status).not.toBe(307);
    });

    it('should handle __Secure- prefixed session cookie', async () => {
      const request = createMockRequest({
        url: '/en/settings/api-keys',
        cookies: {
          '__Secure-authjs.session-token': 'valid-token',
        },
      });

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });
  });

  describe('Auth Routes', () => {
    it('should redirect authenticated users from login page', async () => {
      const request = createMockRequest({
        url: '/en/auth/login',
        cookies: {
          'authjs.session-token': 'valid-token',
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
    });

    it('should redirect authenticated users from register page', async () => {
      const request = createMockRequest({
        url: '/en/auth/register',
        cookies: {
          'authjs.session-token': 'valid-token',
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
    });

    it('should allow unauthenticated users to access login', async () => {
      const request = createMockRequest({
        url: '/en/auth/login',
        cookies: {},
      });

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });
  });

  describe('CORS Headers', () => {
    it('should include all required CORS headers', async () => {
      const request = createMockRequest({
        url: '/api/test',
        method: 'GET',
        origin: 'http://localhost:3000',
      });

      const response = await middleware(request);

      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
      expect(response.headers.get('Access-Control-Expose-Headers')).toContain('X-Request-Id');
    });

    it('should set credentials header', async () => {
      const request = createMockRequest({
        url: '/api/test',
        origin: 'http://localhost:3000',
      });

      const response = await middleware(request);

      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('Security Headers', () => {
    it('should include Content-Security-Policy', async () => {
      const request = createMockRequest({
        url: '/api/test',
      });

      const response = await middleware(request);

      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should include Strict-Transport-Security', async () => {
      const request = createMockRequest({
        url: '/en/dashboard',
      });

      const response = await middleware(request);

      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
      expect(response.headers.get('Strict-Transport-Security')).toContain('includeSubDomains');
    });

    it('should disable dangerous browser features', async () => {
      const request = createMockRequest({
        url: '/en/dashboard',
      });

      const response = await middleware(request);

      const policy = response.headers.get('Permissions-Policy');
      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=()');
    });
  });

  describe('Locale Handling', () => {
    it('should handle Arabic locale', async () => {
      const request = createMockRequest({
        url: '/ar/dashboard',
      });

      const response = await middleware(request);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should handle English locale', async () => {
      const request = createMockRequest({
        url: '/en/dashboard',
      });

      const response = await middleware(request);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
