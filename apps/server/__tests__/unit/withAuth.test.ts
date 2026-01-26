import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { hasRole, isAdmin, type SessionUser } from '../../src/lib/api/withAuth';

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// Mock logger
vi.mock('../../src/lib/api/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import { withAuth, withAdminAuth } from '../../src/lib/api/withAuth';
import { auth } from '@/auth';

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication check', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 401 when session has no user id', async () => {
      vi.mocked(auth).mockResolvedValue({ user: {} } as any);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should call handler when authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      } as any);

      const mockResponse = NextResponse.json({ success: true, data: {} });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][1].user.id).toBe('user-123');
    });
  });

  describe('admin check', () => {
    it('should return 403 when admin required but user is not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'USER',
        },
      } as any);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, { adminOnly: true });
      const request = new Request('http://localhost/api/admin/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toBe('Admin access required');
    });

    it('should allow admin users when admin required', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      } as any);

      const mockResponse = NextResponse.json({ success: true, data: {} });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withAuth(handler, { adminOnly: true });
      const request = new Request('http://localhost/api/admin/test');

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('role check', () => {
    it('should return 403 when user lacks required role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'USER',
        },
      } as any);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, { roles: ['EDITOR', 'ADMIN'] });
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('should allow user with matching role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'EDITOR',
        },
      } as any);

      const mockResponse = NextResponse.json({ success: true, data: {} });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withAuth(handler, { roles: ['EDITOR', 'ADMIN'] });
      const request = new Request('http://localhost/api/test');

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
    });

    it('should return 403 when user has no role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const handler = vi.fn();
      const wrappedHandler = withAuth(handler, { roles: ['EDITOR'] });
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('params resolution', () => {
    it('should resolve and pass route params', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const mockResponse = NextResponse.json({ success: true, data: {} });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      await wrappedHandler(request, {
        params: Promise.resolve({ id: 'param-123' }),
      });

      expect(handler.mock.calls[0][1].params).toEqual({ id: 'param-123' });
    });

    it('should handle missing params', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const mockResponse = NextResponse.json({ success: true, data: {} });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      await wrappedHandler(request);

      expect(handler.mock.calls[0][1].params).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle handler errors', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const handler = vi.fn().mockRejectedValue(new Error('Test error'));
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle non-Error throws', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any);

      const handler = vi.fn().mockRejectedValue('string error');
      const wrappedHandler = withAuth(handler);
      const request = new Request('http://localhost/api/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('withAdminAuth', () => {
  it('should be a shorthand for admin-only routes', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
      },
    } as any);

    const handler = vi.fn();
    const wrappedHandler = withAdminAuth(handler);
    const request = new Request('http://localhost/api/admin/test');

    const response = await wrappedHandler(request);
    const data = await response.json();

    expect(data.error.code).toBe('FORBIDDEN');
  });
});

describe('hasRole', () => {
  it('should return true when user has matching role', () => {
    const user: SessionUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'EDITOR',
    };
    expect(hasRole(user, ['EDITOR', 'ADMIN'])).toBe(true);
  });

  it('should return false when user lacks matching role', () => {
    const user: SessionUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    };
    expect(hasRole(user, ['EDITOR', 'ADMIN'])).toBe(false);
  });

  it('should return false when user has no role', () => {
    const user: SessionUser = {
      id: 'user-123',
      email: 'test@example.com',
    };
    expect(hasRole(user, ['EDITOR'])).toBe(false);
  });
});

describe('isAdmin', () => {
  it('should return true for admin user', () => {
    const user: SessionUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
    expect(isAdmin(user)).toBe(true);
  });

  it('should return false for non-admin user', () => {
    const user: SessionUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    };
    expect(isAdmin(user)).toBe(false);
  });

  it('should return false for user with no role', () => {
    const user: SessionUser = {
      id: 'user-123',
      email: 'test@example.com',
    };
    expect(isAdmin(user)).toBe(false);
  });
});
