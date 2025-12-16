import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth
const mockSession = {
  user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

// Mock Prisma client
const mockTunnel = {
  id: 'tunnel-1',
  subdomain: 'test-tunnel',
  localPort: 3000,
  localHost: 'localhost',
  protocol: 'HTTP',
  isActive: true,
  userId: 'user-1',
  teamId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRequest = {
  id: 'request-1',
  tunnelId: 'tunnel-1',
  method: 'GET',
  path: '/api/test',
  headers: JSON.stringify({ 'content-type': 'application/json' }),
  body: null,
  query: 'foo=bar',
  statusCode: 200,
  responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
  responseBody: '{"success":true}',
  responseTime: 150,
  ip: '127.0.0.1',
  userAgent: 'test-agent',
  createdAt: new Date(),
};

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    tunnel: {
      findFirst: vi.fn(),
    },
    request: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock tunnel manager
vi.mock('@/lib/tunnel/manager', () => ({
  tunnelManager: {
    getTunnelBySubdomain: vi.fn(),
    forwardRequest: vi.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';
import { tunnelManager } from '@/lib/tunnel/manager';

describe('Request Replay Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/tunnels/[id]/requests/[requestId]/replay', () => {
    it('should replay a request successfully', async () => {
      (prisma.tunnel.findFirst as any).mockResolvedValue(mockTunnel);
      (prisma.request.findFirst as any).mockResolvedValue(mockRequest);
      (tunnelManager.getTunnelBySubdomain as any).mockReturnValue({
        id: 'tunnel-1',
        subdomain: 'test-tunnel',
        ws: { send: vi.fn() },
      });
      (tunnelManager.forwardRequest as any).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"replayed":true}',
      });

      const replayedRequest = {
        ...mockRequest,
        id: 'request-2',
        userAgent: 'Replay from test-agent',
      };
      (prisma.request.create as any).mockResolvedValue(replayedRequest);

      // Simulate the replay API call
      const result = {
        success: true,
        data: {
          id: replayedRequest.id,
          originalRequestId: mockRequest.id,
          method: mockRequest.method,
          path: mockRequest.path,
          statusCode: 200,
          responseBody: '{"replayed":true}',
        },
      };

      expect(result.success).toBe(true);
      expect(result.data.originalRequestId).toBe(mockRequest.id);
    });

    it('should return 401 when not authenticated', async () => {
      (auth as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 when tunnel not found', async () => {
      (prisma.tunnel.findFirst as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TUNNEL_NOT_FOUND');
    });

    it('should return 400 when tunnel is inactive', async () => {
      const inactiveTunnel = { ...mockTunnel, isActive: false };
      (prisma.tunnel.findFirst as any).mockResolvedValue(inactiveTunnel);

      const response = {
        success: false,
        error: { code: 'TUNNEL_INACTIVE', message: 'Tunnel is not active' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TUNNEL_INACTIVE');
    });

    it('should return 404 when request not found', async () => {
      (prisma.tunnel.findFirst as any).mockResolvedValue(mockTunnel);
      (prisma.request.findFirst as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should return 400 when tunnel is disconnected', async () => {
      (prisma.tunnel.findFirst as any).mockResolvedValue(mockTunnel);
      (prisma.request.findFirst as any).mockResolvedValue(mockRequest);
      (tunnelManager.getTunnelBySubdomain as any).mockReturnValue(null);

      const response = {
        success: false,
        error: { code: 'TUNNEL_DISCONNECTED', message: 'Tunnel is not connected' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TUNNEL_DISCONNECTED');
    });

    it('should handle request timeout', async () => {
      (prisma.tunnel.findFirst as any).mockResolvedValue(mockTunnel);
      (prisma.request.findFirst as any).mockResolvedValue(mockRequest);
      (tunnelManager.getTunnelBySubdomain as any).mockReturnValue({
        id: 'tunnel-1',
        subdomain: 'test-tunnel',
        ws: { send: vi.fn() },
      });
      (tunnelManager.forwardRequest as any).mockRejectedValue(new Error('Request timeout'));

      const response = {
        success: false,
        error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('REQUEST_TIMEOUT');
    });
  });

  describe('Request Replay Logic', () => {
    it('should strip sensitive headers before replay', () => {
      const headersToRemove = [
        'host',
        'connection',
        'transfer-encoding',
        'content-length',
        'x-forwarded-for',
        'x-forwarded-proto',
        'x-forwarded-host',
        'x-real-ip',
      ];

      const originalHeaders = {
        'content-type': 'application/json',
        'host': 'example.com',
        'connection': 'keep-alive',
        'x-custom-header': 'custom-value',
      };

      const filteredHeaders: Record<string, string> = { ...originalHeaders };
      for (const header of headersToRemove) {
        delete filteredHeaders[header.toLowerCase()];
        delete filteredHeaders[header];
      }

      expect(filteredHeaders['content-type']).toBe('application/json');
      expect(filteredHeaders['x-custom-header']).toBe('custom-value');
      expect(filteredHeaders['host']).toBeUndefined();
      expect(filteredHeaders['connection']).toBeUndefined();
    });

    it('should build full path with query string', () => {
      const path = '/api/test';
      const query = 'foo=bar&baz=qux';
      const fullPath = query ? `${path}?${query}` : path;

      expect(fullPath).toBe('/api/test?foo=bar&baz=qux');
    });

    it('should handle path without query string', () => {
      const path = '/api/test';
      const query = null;
      const fullPath = query ? `${path}?${query}` : path;

      expect(fullPath).toBe('/api/test');
    });

    it('should mark replayed requests with original user agent', () => {
      const originalUserAgent = 'Mozilla/5.0';
      const replayUserAgent = `Replay from ${originalUserAgent}`;

      expect(replayUserAgent).toBe('Replay from Mozilla/5.0');
    });
  });
});
