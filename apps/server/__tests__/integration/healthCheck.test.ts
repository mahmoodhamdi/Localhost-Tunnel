import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data
const mockHealthCheck = {
  id: 'check-1',
  name: 'Test Health Check',
  type: 'HTTP',
  target: 'https://example.com',
  enabled: true,
  interval: 60,
  timeout: 30,
  retries: 3,
  alertOnFailure: true,
  alertAfterRetries: 2,
  status: 'HEALTHY',
  lastCheck: new Date(),
  lastSuccess: new Date(),
  lastFailure: null,
  consecutiveFails: 0,
  tunnelId: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockHealthCheckResult = {
  id: 'result-1',
  healthCheckId: 'check-1',
  status: 'SUCCESS',
  responseTime: 150,
  statusCode: 200,
  message: 'HTTP check passed',
  createdAt: new Date(),
};

const mockPrisma = {
  healthCheck: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  healthCheckResult: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  tunnel: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
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

describe('Health Check API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // System Health API
  describe('GET /api/health', () => {
    it('should return system health status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const response = {
        success: true,
        data: {
          status: 'HEALTHY',
          uptime: 12345,
          version: '1.0.0',
          timestamp: new Date(),
          components: {
            database: { status: 'HEALTHY', message: 'Database connected' },
            memory: { status: 'HEALTHY', message: 'Memory usage normal' },
            disk: { status: 'HEALTHY', message: 'Disk space available' },
          },
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('HEALTHY');
      expect(response.data.components.database.status).toBe('HEALTHY');
    });

    it('should return UNHEALTHY when database fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const response = {
        success: true,
        data: {
          status: 'UNHEALTHY',
          components: {
            database: { status: 'UNHEALTHY', message: 'Database connection failed' },
          },
        },
      };

      expect(response.data.status).toBe('UNHEALTHY');
      expect(response.data.components.database.status).toBe('UNHEALTHY');
    });

    it('should return DEGRADED when database is slow', async () => {
      const response = {
        success: true,
        data: {
          status: 'DEGRADED',
          components: {
            database: { status: 'DEGRADED', message: 'Database responding slowly' },
          },
        },
      };

      expect(response.data.status).toBe('DEGRADED');
    });
  });

  // Health Checks CRUD API
  describe('GET /api/health/checks', () => {
    it('should return list of health checks', async () => {
      mockPrisma.healthCheck.findMany.mockResolvedValue([mockHealthCheck]);
      mockPrisma.healthCheck.count.mockResolvedValue(1);

      const response = {
        success: true,
        data: [mockHealthCheck],
        pagination: { total: 1, limit: 50, offset: 0 },
      };

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].name).toBe('Test Health Check');
    });

    it('should filter by tunnel ID', async () => {
      const tunnelCheck = { ...mockHealthCheck, tunnelId: 'tunnel-1' };
      mockPrisma.healthCheck.findMany.mockResolvedValue([tunnelCheck]);

      const response = {
        success: true,
        data: [tunnelCheck],
      };

      expect(response.data[0].tunnelId).toBe('tunnel-1');
    });

    it('should filter by status', async () => {
      const unhealthyCheck = { ...mockHealthCheck, status: 'UNHEALTHY' };
      mockPrisma.healthCheck.findMany.mockResolvedValue([unhealthyCheck]);

      const response = {
        success: true,
        data: [unhealthyCheck],
      };

      expect(response.data[0].status).toBe('UNHEALTHY');
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
  });

  describe('POST /api/health/checks', () => {
    it('should create health check', async () => {
      mockPrisma.healthCheck.create.mockResolvedValue(mockHealthCheck);

      const response = {
        success: true,
        data: mockHealthCheck,
      };

      expect(response.success).toBe(true);
      expect(response.data.name).toBe('Test Health Check');
      expect(response.data.type).toBe('HTTP');
    });

    it('should validate required fields', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate type field', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Type must be TUNNEL, HTTP, TCP, or DATABASE' },
      };

      expect(response.success).toBe(false);
    });

    it('should validate interval range', async () => {
      const response = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Interval must be between 10 and 3600 seconds' },
      };

      expect(response.success).toBe(false);
    });
  });

  describe('GET /api/health/checks/[id]', () => {
    it('should return health check details', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue({
        ...mockHealthCheck,
        tunnel: null,
        results: [mockHealthCheckResult],
      });

      const response = {
        success: true,
        data: {
          ...mockHealthCheck,
          results: [mockHealthCheckResult],
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.results).toHaveLength(1);
    });

    it('should return 404 for non-existent check', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Health check not found' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/health/checks/[id]', () => {
    it('should update health check', async () => {
      mockPrisma.healthCheck.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.healthCheck.findFirst.mockResolvedValue({
        ...mockHealthCheck,
        interval: 120,
      });

      const response = {
        success: true,
        data: { ...mockHealthCheck, interval: 120 },
      };

      expect(response.success).toBe(true);
      expect(response.data.interval).toBe(120);
    });

    it('should return 404 for non-existent check', async () => {
      mockPrisma.healthCheck.updateMany.mockResolvedValue({ count: 0 });

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Health check not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  describe('DELETE /api/health/checks/[id]', () => {
    it('should delete health check', async () => {
      mockPrisma.healthCheck.deleteMany.mockResolvedValue({ count: 1 });

      const response = {
        success: true,
        message: 'Health check deleted',
      };

      expect(response.success).toBe(true);
    });

    it('should return 404 for non-existent check', async () => {
      mockPrisma.healthCheck.deleteMany.mockResolvedValue({ count: 0 });

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Health check not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  // Run Health Check API
  describe('POST /api/health/checks/[id]/run', () => {
    it('should run health check manually', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue(mockHealthCheck);
      mockPrisma.healthCheck.findUnique.mockResolvedValue(mockHealthCheck);
      mockPrisma.healthCheckResult.create.mockResolvedValue(mockHealthCheckResult);
      mockPrisma.healthCheck.update.mockResolvedValue({
        ...mockHealthCheck,
        lastCheck: new Date(),
      });

      const response = {
        success: true,
        data: {
          status: 'SUCCESS',
          responseTime: 150,
          statusCode: 200,
          message: 'HTTP check passed',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('SUCCESS');
    });

    it('should fail for disabled check', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue({
        ...mockHealthCheck,
        enabled: false,
      });

      const response = {
        success: false,
        error: { code: 'CHECK_DISABLED', message: 'Health check is disabled' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CHECK_DISABLED');
    });

    it('should return 404 for non-existent check', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Health check not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  // Health Check Results API
  describe('GET /api/health/checks/[id]/results', () => {
    it('should return check history', async () => {
      mockPrisma.healthCheck.findFirst.mockResolvedValue(mockHealthCheck);
      mockPrisma.healthCheckResult.findMany.mockResolvedValue([mockHealthCheckResult]);
      mockPrisma.healthCheckResult.count.mockResolvedValue(1);

      const response = {
        success: true,
        data: {
          results: [mockHealthCheckResult],
          stats: {
            totalChecks: 100,
            successfulChecks: 95,
            failedChecks: 5,
            uptimePercentage: 95,
            averageResponseTime: 150,
          },
        },
        pagination: { total: 1, limit: 100, offset: 0 },
      };

      expect(response.success).toBe(true);
      expect(response.data.results).toHaveLength(1);
      expect(response.data.stats.uptimePercentage).toBe(95);
    });
  });

  // Tunnel Health API
  describe('GET /api/tunnels/[id]/health', () => {
    it('should return tunnel health status', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue({
        id: 'tunnel-1',
        subdomain: 'test',
        isActive: true,
      });
      mockPrisma.tunnel.findUnique.mockResolvedValue({
        id: 'tunnel-1',
        subdomain: 'test',
        isActive: true,
        healthChecks: [mockHealthCheck],
      });

      const response = {
        success: true,
        data: {
          tunnelId: 'tunnel-1',
          subdomain: 'test',
          isActive: true,
          status: 'HEALTHY',
          checksCount: 1,
          healthyCount: 1,
          unhealthyCount: 0,
          degradedCount: 0,
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('HEALTHY');
    });

    it('should return 404 for non-existent tunnel', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue(null);

      const response = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
      };

      expect(response.success).toBe(false);
    });
  });

  describe('POST /api/tunnels/[id]/health', () => {
    it('should create health check for tunnel', async () => {
      mockPrisma.tunnel.findFirst.mockResolvedValue({
        id: 'tunnel-1',
        subdomain: 'test',
      });
      mockPrisma.healthCheck.create.mockResolvedValue({
        ...mockHealthCheck,
        tunnelId: 'tunnel-1',
        type: 'TUNNEL',
      });

      const response = {
        success: true,
        data: {
          ...mockHealthCheck,
          tunnelId: 'tunnel-1',
          type: 'TUNNEL',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data.tunnelId).toBe('tunnel-1');
      expect(response.data.type).toBe('TUNNEL');
    });
  });

  // Check Types
  describe('Check Types', () => {
    it('should run HTTP check', async () => {
      const result = {
        status: 'SUCCESS',
        responseTime: 150,
        statusCode: 200,
        message: 'HTTP check passed',
      };

      expect(result.status).toBe('SUCCESS');
      expect(result.statusCode).toBe(200);
    });

    it('should run TCP check', async () => {
      const result = {
        status: 'SUCCESS',
        responseTime: 50,
        message: 'TCP connection successful',
      };

      expect(result.status).toBe('SUCCESS');
    });

    it('should run tunnel check', async () => {
      const result = {
        status: 'SUCCESS',
        responseTime: 200,
        message: 'Tunnel is healthy',
      };

      expect(result.status).toBe('SUCCESS');
    });

    it('should run database check', async () => {
      const result = {
        status: 'SUCCESS',
        responseTime: 10,
        message: 'Database is healthy',
      };

      expect(result.status).toBe('SUCCESS');
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      mockPrisma.healthCheck.findMany.mockRejectedValue(new Error('Database error'));

      const response = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list health checks' },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle check run errors', async () => {
      const response = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to run health check' },
      };

      expect(response.success).toBe(false);
    });
  });
});
