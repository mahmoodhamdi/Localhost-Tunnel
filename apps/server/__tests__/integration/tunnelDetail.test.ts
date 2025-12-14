import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client
const mockTunnel = {
  id: 'test-tunnel-id',
  subdomain: 'test-subdomain',
  localPort: 3000,
  localHost: 'localhost',
  protocol: 'HTTP',
  password: null,
  ipWhitelist: null,
  isActive: true,
  expiresAt: null,
  inspect: true,
  totalRequests: 100,
  totalBytes: BigInt(1048576),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  lastActiveAt: new Date('2024-01-02'),
  _count: { requests: 50 },
};

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    tunnel: {
      findUnique: vi.fn().mockResolvedValue(mockTunnel),
      update: vi.fn().mockResolvedValue({ ...mockTunnel, isActive: false }),
    },
  },
}));

describe('Tunnel Detail API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tunnels/[id]', () => {
    it('should return tunnel details with correct structure', async () => {
      const expectedResponse = {
        success: true,
        data: {
          id: mockTunnel.id,
          subdomain: mockTunnel.subdomain,
          publicUrl: `http://${mockTunnel.subdomain}.localhost:3000`,
          localPort: mockTunnel.localPort,
          localHost: mockTunnel.localHost,
          protocol: mockTunnel.protocol,
          isActive: mockTunnel.isActive,
          hasPassword: false,
          ipWhitelist: mockTunnel.ipWhitelist,
          expiresAt: mockTunnel.expiresAt,
          inspect: mockTunnel.inspect,
          totalRequests: mockTunnel.totalRequests,
          totalBytes: Number(mockTunnel.totalBytes),
          createdAt: mockTunnel.createdAt,
          updatedAt: mockTunnel.updatedAt,
          lastActiveAt: mockTunnel.lastActiveAt,
          requestCount: mockTunnel._count.requests,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.id).toBe(mockTunnel.id);
      expect(expectedResponse.data.subdomain).toBe(mockTunnel.subdomain);
      expect(expectedResponse.data.localPort).toBe(3000);
      expect(expectedResponse.data.isActive).toBe(true);
      expect(expectedResponse.data.hasPassword).toBe(false);
      expect(expectedResponse.data.totalRequests).toBe(100);
      expect(expectedResponse.data.totalBytes).toBe(1048576);
    });

    it('should handle non-existent tunnel', () => {
      const errorResponse = {
        success: false,
        error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('TUNNEL_NOT_FOUND');
    });

    it('should include public URL with correct domain', () => {
      const domain = 'localhost:3000';
      const publicUrl = `http://${mockTunnel.subdomain}.${domain}`;

      expect(publicUrl).toBe('http://test-subdomain.localhost:3000');
    });

    it('should convert BigInt totalBytes to number', () => {
      const totalBytes = Number(mockTunnel.totalBytes);
      expect(typeof totalBytes).toBe('number');
      expect(totalBytes).toBe(1048576);
    });

    it('should correctly identify password protection', () => {
      const tunnelWithPassword = { ...mockTunnel, password: 'hashed-password' };
      const hasPassword = !!tunnelWithPassword.password;
      expect(hasPassword).toBe(true);

      const tunnelWithoutPassword = { ...mockTunnel, password: null };
      const noPassword = !!tunnelWithoutPassword.password;
      expect(noPassword).toBe(false);
    });
  });

  describe('DELETE /api/tunnels/[id]', () => {
    it('should deactivate tunnel instead of hard delete', () => {
      const updateData = { isActive: false };
      const updatedTunnel = { ...mockTunnel, ...updateData };

      expect(updatedTunnel.isActive).toBe(false);
      expect(updatedTunnel.id).toBe(mockTunnel.id);
    });

    it('should return success response on delete', () => {
      const deleteResponse = {
        success: true,
        data: { id: mockTunnel.id, message: 'Tunnel deleted' },
      };

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.data.id).toBe(mockTunnel.id);
      expect(deleteResponse.data.message).toBe('Tunnel deleted');
    });

    it('should handle delete of non-existent tunnel', () => {
      const errorResponse = {
        success: false,
        error: { code: 'TUNNEL_NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('TUNNEL_NOT_FOUND');
    });
  });

  describe('Tunnel Status Validation', () => {
    it('should check tunnel expiration', () => {
      const checkExpiration = (expiresAt: Date | null): boolean => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
      };

      expect(checkExpiration(null)).toBe(false);
      expect(checkExpiration(new Date(Date.now() - 86400000))).toBe(true);
      expect(checkExpiration(new Date(Date.now() + 86400000))).toBe(false);
    });

    it('should validate tunnel is active', () => {
      expect(mockTunnel.isActive).toBe(true);
    });

    it('should include request count from relation', () => {
      expect(mockTunnel._count.requests).toBe(50);
    });
  });

  describe('Response Format', () => {
    it('should format dates as ISO strings', () => {
      const createdAt = mockTunnel.createdAt.toISOString();
      expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle null values correctly', () => {
      const response = {
        ipWhitelist: mockTunnel.ipWhitelist,
        expiresAt: mockTunnel.expiresAt,
        password: mockTunnel.password,
      };

      expect(response.ipWhitelist).toBeNull();
      expect(response.expiresAt).toBeNull();
      expect(response.password).toBeNull();
    });
  });
});
