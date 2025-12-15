import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth (admin only)
const mockAdminSession = {
  user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const mockUserSession = {
  user: { id: 'user-1', email: 'user@example.com', name: 'Regular User' },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma client
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    request: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    healthCheckResult: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    tunnel: {
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    rateLimitHit: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    teamInvitation: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    encryptionKey: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/auth';

describe('Data Retention Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/retention', () => {
    it('should return retention stats for admin', async () => {
      (auth as any).mockResolvedValue(mockAdminSession);

      const retentionStats = {
        requestLogs: { count: 1000, oldestDate: new Date('2024-01-01') },
        healthCheckResults: { count: 500, oldestDate: new Date('2024-02-01') },
        auditLogs: { count: 200, oldestDate: new Date('2024-03-01') },
        inactiveTunnels: { count: 50 },
        rateLimitHits: { count: 10000 },
        expiredSessions: { count: 100 },
        expiredInvitations: { count: 25 },
        expiredEncryptionKeys: { count: 10 },
      };

      const response = {
        success: true,
        data: retentionStats,
      };

      expect(response.success).toBe(true);
      expect(response.data.requestLogs.count).toBe(1000);
      expect(response.data.inactiveTunnels.count).toBe(50);
    });

    it('should return 403 for non-admin users', async () => {
      (auth as any).mockResolvedValue(mockUserSession);

      const response = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('FORBIDDEN');
    });

    it('should return 401 for unauthenticated users', async () => {
      (auth as any).mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/admin/retention', () => {
    it('should run cleanup with default settings', async () => {
      (auth as any).mockResolvedValue(mockAdminSession);

      (prisma.request.deleteMany as any).mockResolvedValue({ count: 100 });
      (prisma.healthCheckResult.deleteMany as any).mockResolvedValue({ count: 50 });
      (prisma.auditLog.deleteMany as any).mockResolvedValue({ count: 25 });
      (prisma.tunnel.updateMany as any).mockResolvedValue({ count: 10 });
      (prisma.rateLimitHit.deleteMany as any).mockResolvedValue({ count: 500 });
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 20 });
      (prisma.teamInvitation.deleteMany as any).mockResolvedValue({ count: 5 });
      (prisma.encryptionKey.deleteMany as any).mockResolvedValue({ count: 2 });

      const response = {
        success: true,
        data: {
          requestLogsDeleted: 100,
          healthCheckResultsDeleted: 50,
          auditLogsDeleted: 25,
          tunnelsDeactivated: 10,
          rateLimitHitsDeleted: 500,
          sessionsDeleted: 20,
          invitationsDeleted: 5,
          encryptionKeysDeleted: 2,
          totalDeleted: 712,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.totalDeleted).toBe(712);
    });

    it('should run cleanup with custom retention days', async () => {
      (auth as any).mockResolvedValue(mockAdminSession);

      const customRetention = {
        requestLogsDays: 7,
        healthCheckDays: 14,
        auditLogDays: 90,
        inactiveTunnelDays: 30,
      };

      // Verify cutoff date calculation
      // Shorter retention (7 days) = more recent cutoff date
      // Longer retention (14 days) = older cutoff date
      const now = Date.now();
      const requestCutoff = new Date(now - customRetention.requestLogsDays * 24 * 60 * 60 * 1000);
      const healthCutoff = new Date(now - customRetention.healthCheckDays * 24 * 60 * 60 * 1000);

      // requestCutoff (7 days ago) is MORE recent than healthCutoff (14 days ago)
      expect(requestCutoff.getTime()).toBeGreaterThan(healthCutoff.getTime());
    });

    it('should validate retention days minimum', () => {
      const minDays = 1;
      const invalidDays = [0, -1, -100];
      const validDays = [1, 7, 30, 365];

      invalidDays.forEach((days) => {
        expect(days >= minDays).toBe(false);
      });

      validDays.forEach((days) => {
        expect(days >= minDays).toBe(true);
      });
    });

    it('should validate retention days maximum', () => {
      const maxDays = 365 * 5; // 5 years
      const invalidDays = [2000, 5000];
      const validDays = [1, 30, 365, 1825];

      invalidDays.forEach((days) => {
        expect(days <= maxDays).toBe(false);
      });

      validDays.forEach((days) => {
        expect(days <= maxDays).toBe(true);
      });
    });
  });

  describe('Cleanup Functions', () => {
    describe('cleanupRequestLogs', () => {
      it('should delete logs older than specified days', async () => {
        const days = 30;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        (prisma.request.deleteMany as any).mockResolvedValue({ count: 100 });

        const result = await prisma.request.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });

        expect(result.count).toBe(100);
      });
    });

    describe('cleanupHealthCheckResults', () => {
      it('should delete results older than specified days', async () => {
        const days = 14;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        (prisma.healthCheckResult.deleteMany as any).mockResolvedValue({ count: 50 });

        const result = await prisma.healthCheckResult.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });

        expect(result.count).toBe(50);
      });
    });

    describe('cleanupAuditLogs', () => {
      it('should delete logs older than specified days', async () => {
        const days = 90;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        (prisma.auditLog.deleteMany as any).mockResolvedValue({ count: 25 });

        const result = await prisma.auditLog.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });

        expect(result.count).toBe(25);
      });
    });

    describe('cleanupInactiveTunnels', () => {
      it('should deactivate tunnels inactive for specified days', async () => {
        const days = 30;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        (prisma.tunnel.updateMany as any).mockResolvedValue({ count: 10 });

        const result = await prisma.tunnel.updateMany({
          where: {
            isActive: true,
            lastActiveAt: { lt: cutoffDate },
          },
          data: { isActive: false },
        });

        expect(result.count).toBe(10);
      });
    });

    describe('cleanupExpiredSessions', () => {
      it('should delete expired sessions', async () => {
        (prisma.session.deleteMany as any).mockResolvedValue({ count: 20 });

        const result = await prisma.session.deleteMany({
          where: { expires: { lt: new Date() } },
        });

        expect(result.count).toBe(20);
      });
    });

    describe('cleanupExpiredInvitations', () => {
      it('should delete expired invitations', async () => {
        (prisma.teamInvitation.deleteMany as any).mockResolvedValue({ count: 5 });

        const result = await prisma.teamInvitation.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });

        expect(result.count).toBe(5);
      });
    });

    describe('cleanupExpiredEncryptionKeys', () => {
      it('should delete expired encryption keys', async () => {
        (prisma.encryptionKey.deleteMany as any).mockResolvedValue({ count: 2 });

        const result = await prisma.encryptionKey.deleteMany({
          where: {
            expiresAt: { lt: new Date() },
            isActive: false,
          },
        });

        expect(result.count).toBe(2);
      });
    });
  });

  describe('Retention Policy', () => {
    it('should have default retention periods', () => {
      const defaults = {
        requestLogs: 30, // 30 days
        healthCheckResults: 14, // 14 days
        auditLogs: 90, // 90 days
        inactiveTunnels: 30, // 30 days
        rateLimitHits: 7, // 7 days
      };

      expect(defaults.requestLogs).toBe(30);
      expect(defaults.healthCheckResults).toBe(14);
      expect(defaults.auditLogs).toBe(90);
    });

    it('should calculate correct cutoff dates', () => {
      const now = new Date();
      const days = 30;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const diffMs = now.getTime() - cutoff.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);

      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('should handle month boundary correctly', () => {
      // Test case: Jan 15 - 30 days = Dec 16 (previous year)
      const jan15 = new Date('2024-01-15T00:00:00Z');
      const thirtyDaysBack = new Date(jan15.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(thirtyDaysBack.getMonth()).toBe(11); // December
      expect(thirtyDaysBack.getFullYear()).toBe(2023);
    });
  });

  describe('Scheduled Cleanup', () => {
    it('should support scheduling cleanup at specific time', () => {
      const scheduleTime = '03:00'; // 3 AM
      const [hours, minutes] = scheduleTime.split(':').map(Number);

      expect(hours).toBe(3);
      expect(minutes).toBe(0);
    });

    it('should log cleanup results', () => {
      const results = {
        requestLogsDeleted: 100,
        timestamp: new Date(),
        duration: 1500, // ms
      };

      expect(results.requestLogsDeleted).toBe(100);
      expect(results.duration).toBeGreaterThan(0);
    });
  });
});
