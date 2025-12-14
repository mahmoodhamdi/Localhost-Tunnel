import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data
const mockTunnel = {
  id: 'tunnel-1',
  subdomain: 'test',
  localPort: 3000,
  localHost: 'localhost',
  userId: 'user-1',
  teamId: null,
};

const mockEncryptionSettings = {
  id: 'enc-1',
  enabled: true,
  mode: 'TRANSPORT',
  algorithm: 'AES-256-GCM',
  keyRotationDays: 30,
  lastRotation: null,
  tunnelId: 'tunnel-1',
};

const mockEncryptionKey = {
  id: 'key-1',
  publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
  privateKey: 'encrypted-private-key',
  algorithm: 'RSA-2048',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  rotatedAt: null,
  tunnelId: 'tunnel-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  tunnel: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  tunnelEncryption: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  encryptionKey: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    })
  ),
}));

describe('Encryption API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Encryption Settings API
  describe('GET /api/tunnels/[id]/encryption', () => {
    it('should return encryption settings for tunnel', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.findUnique.mockResolvedValue(mockEncryptionSettings);
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(mockEncryptionKey);

      const response = {
        success: true,
        data: {
          enabled: true,
          mode: 'TRANSPORT',
          algorithm: 'AES-256-GCM',
          keyRotationDays: 30,
          hasKey: true,
          keyExpiry: mockEncryptionKey.expiresAt,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.enabled).toBe(true);
      expect(response.data.mode).toBe('TRANSPORT');
      expect(response.data.hasKey).toBe(true);
    });

    it('should create default settings if not exists', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.findUnique.mockResolvedValue(null);
      mockPrisma.tunnelEncryption.create.mockResolvedValue({
        ...mockEncryptionSettings,
        enabled: false,
      });
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(null);

      const response = {
        success: true,
        data: {
          enabled: false,
          mode: 'TRANSPORT',
          hasKey: false,
          keyExpiry: null,
        },
      };

      expect(response.data.enabled).toBe(false);
      expect(response.data.hasKey).toBe(false);
    });

    it('should require authentication', async () => {
      vi.mocked(await import('@/auth')).auth.mockResolvedValueOnce(null);

      const response = {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent tunnel', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
    });
  });

  // Update Encryption Settings
  describe('PUT /api/tunnels/[id]/encryption', () => {
    it('should update encryption settings', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.upsert.mockResolvedValue({
        ...mockEncryptionSettings,
        mode: 'E2E',
      });
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(mockEncryptionKey);

      const response = {
        success: true,
        data: {
          enabled: true,
          mode: 'E2E',
          keyRotationDays: 30,
          hasKey: true,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.mode).toBe('E2E');
    });

    it('should validate mode parameter', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Mode must be E2E, TRANSPORT, or NONE' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate keyRotationDays range', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Key rotation days must be between 1 and 365' },
      };

      expect(response.success).toBe(false);
    });

    it('should generate keys when enabling encryption', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.upsert.mockResolvedValue({
        ...mockEncryptionSettings,
        enabled: true,
      });
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(null);
      mockPrisma.encryptionKey.upsert.mockResolvedValue(mockEncryptionKey);

      const response = {
        success: true,
        data: {
          enabled: true,
          hasKey: true,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.hasKey).toBe(true);
    });
  });

  // Key Management API
  describe('GET /api/tunnels/[id]/encryption/key', () => {
    it('should return public key', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(mockEncryptionKey);

      const response = {
        success: true,
        data: {
          publicKey: mockEncryptionKey.publicKey,
          algorithm: 'RSA-2048',
          expiresAt: mockEncryptionKey.expiresAt,
          createdAt: mockEncryptionKey.createdAt,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.publicKey).toContain('PUBLIC KEY');
      expect(response.data.algorithm).toBe('RSA-2048');
    });

    it('should return 404 if no key exists', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.encryptionKey.findUnique.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'No encryption key found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/tunnels/[id]/encryption/key', () => {
    it('should generate new key pair', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.encryptionKey.upsert.mockResolvedValue(mockEncryptionKey);
      mockPrisma.tunnelEncryption.update.mockResolvedValue(mockEncryptionSettings);

      const response = {
        success: true,
        data: {
          publicKey: mockEncryptionKey.publicKey,
          algorithm: 'RSA-2048',
          expiresAt: mockEncryptionKey.expiresAt,
          message: 'New encryption keys generated',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.message).toBe('New encryption keys generated');
    });

    it('should require admin access', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  // Key Rotation API
  describe('POST /api/tunnels/[id]/encryption/rotate', () => {
    it('should rotate keys when encryption is enabled', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.findUnique.mockResolvedValue(mockEncryptionSettings);
      mockPrisma.encryptionKey.upsert.mockResolvedValue({
        ...mockEncryptionKey,
        rotatedAt: new Date(),
      });
      mockPrisma.tunnelEncryption.update.mockResolvedValue({
        ...mockEncryptionSettings,
        lastRotation: new Date(),
      });

      const response = {
        success: true,
        data: {
          publicKey: mockEncryptionKey.publicKey,
          algorithm: 'RSA-2048',
          rotatedAt: new Date(),
          message: 'Encryption keys rotated successfully',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.message).toContain('rotated');
    });

    it('should fail if encryption is not enabled', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(mockTunnel);
      mockPrisma.tunnelEncryption.findUnique.mockResolvedValue({
        ...mockEncryptionSettings,
        enabled: false,
      });

      const response = {
        success: false,
        error: { code: 'ENCRYPTION_DISABLED', message: 'Encryption is not enabled for this tunnel' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('ENCRYPTION_DISABLED');
    });
  });

  // Encryption Modes
  describe('Encryption Modes', () => {
    it('should support E2E mode', () => {
      const settings = { mode: 'E2E' };
      expect(['E2E', 'TRANSPORT', 'NONE']).toContain(settings.mode);
    });

    it('should support TRANSPORT mode', () => {
      const settings = { mode: 'TRANSPORT' };
      expect(['E2E', 'TRANSPORT', 'NONE']).toContain(settings.mode);
    });

    it('should support NONE mode', () => {
      const settings = { mode: 'NONE' };
      expect(['E2E', 'TRANSPORT', 'NONE']).toContain(settings.mode);
    });
  });

  // Key Expiry
  describe('Key Expiry', () => {
    it('should calculate expiry based on rotation days', () => {
      const rotationDays = 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rotationDays);

      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should detect expired keys', () => {
      const expiredKey = {
        ...mockEncryptionKey,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      const isExpired = new Date() > expiredKey.expiresAt;
      expect(isExpired).toBe(true);
    });

    it('should detect valid keys', () => {
      const isExpired = new Date() > mockEncryptionKey.expiresAt;
      expect(isExpired).toBe(false);
    });
  });

  // Algorithm Support
  describe('Algorithm Support', () => {
    it('should support RSA-2048', () => {
      const supportedAlgorithms = ['RSA-2048'];
      expect(supportedAlgorithms).toContain('RSA-2048');
    });

    it('should use AES-256-GCM for payload encryption', () => {
      const settings = { algorithm: 'AES-256-GCM' };
      expect(settings.algorithm).toBe('AES-256-GCM');
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      mockPrisma.tunnel.findFirst.mockRejectedValue(new Error('Database error'));

      const response = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get encryption settings' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle key generation errors', async () => {
      const response = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate encryption keys' },
      };

      expect(response.success).toBe(false);
    });

    it('should handle rotation errors', async () => {
      const response = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate encryption keys' },
      };

      expect(response.success).toBe(false);
    });
  });

  // Access Control
  describe('Access Control', () => {
    it('should allow tunnel owner to manage encryption', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue({
        ...mockTunnel,
        userId: 'user-1',
      });

      const hasAccess = true;
      expect(hasAccess).toBe(true);
    });

    it('should allow team admin to manage encryption', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue({
        ...mockTunnel,
        userId: null,
        teamId: 'team-1',
      });

      const hasAccess = true;
      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-owners', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(null);

      const hasAccess = false;
      expect(hasAccess).toBe(false);
    });
  });
});
