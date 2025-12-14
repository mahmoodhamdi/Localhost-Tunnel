import { describe, it, expect } from 'vitest';

describe('Analytics Utilities', () => {
  describe('formatBytes', () => {
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    it('should return 0 B for zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format various byte sizes correctly', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('Metrics Calculation', () => {
    interface Request {
      statusCode: number | null;
      responseTime: number | null;
      ip: string | null;
    }

    const calculateMetrics = (requests: Request[]) => {
      const totalRequests = requests.length;
      const uniqueIps = new Set(requests.map((r) => r.ip).filter(Boolean)).size;

      const responseTimes = requests.map((r) => r.responseTime).filter((t): t is number => t !== null);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      const successfulRequests = requests.filter(
        (r) => r.statusCode && r.statusCode >= 200 && r.statusCode < 400
      ).length;
      const successRate = totalRequests > 0
        ? Math.round((successfulRequests / totalRequests) * 100)
        : 0;
      const errorRate = totalRequests > 0
        ? Math.round(((totalRequests - successfulRequests) / totalRequests) * 100)
        : 0;

      return { totalRequests, uniqueIps, avgResponseTime, successRate, errorRate };
    };

    const mockRequests: Request[] = [
      { statusCode: 200, responseTime: 50, ip: '192.168.1.1' },
      { statusCode: 200, responseTime: 100, ip: '192.168.1.2' },
      { statusCode: 404, responseTime: 30, ip: '192.168.1.1' },
      { statusCode: 500, responseTime: 200, ip: '192.168.1.3' },
      { statusCode: 200, responseTime: 80, ip: '192.168.1.1' },
    ];

    it('should calculate total requests', () => {
      const metrics = calculateMetrics(mockRequests);
      expect(metrics.totalRequests).toBe(5);
    });

    it('should calculate unique IPs', () => {
      const metrics = calculateMetrics(mockRequests);
      expect(metrics.uniqueIps).toBe(3);
    });

    it('should calculate average response time', () => {
      const metrics = calculateMetrics(mockRequests);
      expect(metrics.avgResponseTime).toBe(92); // (50+100+30+200+80)/5 = 92
    });

    it('should calculate success rate', () => {
      const metrics = calculateMetrics(mockRequests);
      expect(metrics.successRate).toBe(60); // 3 successful out of 5
    });

    it('should calculate error rate', () => {
      const metrics = calculateMetrics(mockRequests);
      expect(metrics.errorRate).toBe(40); // 2 errors out of 5
    });

    it('should handle empty array', () => {
      const metrics = calculateMetrics([]);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.uniqueIps).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });
  });

  describe('Method Count Aggregation', () => {
    interface Request {
      method: string;
    }

    const aggregateByMethod = (requests: Request[]): Record<string, number> => {
      const counts: Record<string, number> = {};
      requests.forEach((r) => {
        counts[r.method] = (counts[r.method] || 0) + 1;
      });
      return counts;
    };

    it('should count requests by method', () => {
      const requests: Request[] = [
        { method: 'GET' },
        { method: 'POST' },
        { method: 'GET' },
        { method: 'GET' },
        { method: 'DELETE' },
      ];

      const counts = aggregateByMethod(requests);
      expect(counts.GET).toBe(3);
      expect(counts.POST).toBe(1);
      expect(counts.DELETE).toBe(1);
    });

    it('should handle empty array', () => {
      const counts = aggregateByMethod([]);
      expect(Object.keys(counts).length).toBe(0);
    });
  });

  describe('Status Code Aggregation', () => {
    interface Request {
      statusCode: number | null;
    }

    const aggregateByStatus = (requests: Request[]): Record<string, number> => {
      const counts: Record<string, number> = {};
      requests.forEach((r) => {
        if (r.statusCode) {
          const statusGroup = `${Math.floor(r.statusCode / 100)}xx`;
          counts[statusGroup] = (counts[statusGroup] || 0) + 1;
        }
      });
      return counts;
    };

    it('should group status codes', () => {
      const requests: Request[] = [
        { statusCode: 200 },
        { statusCode: 201 },
        { statusCode: 301 },
        { statusCode: 404 },
        { statusCode: 500 },
        { statusCode: null },
      ];

      const counts = aggregateByStatus(requests);
      expect(counts['2xx']).toBe(2);
      expect(counts['3xx']).toBe(1);
      expect(counts['4xx']).toBe(1);
      expect(counts['5xx']).toBe(1);
    });

    it('should skip null status codes', () => {
      const requests: Request[] = [
        { statusCode: null },
        { statusCode: null },
      ];

      const counts = aggregateByStatus(requests);
      expect(Object.keys(counts).length).toBe(0);
    });
  });

  describe('Date Range Calculation', () => {
    const getStartDate = (range: string): Date => {
      const now = new Date();

      switch (range) {
        case '24h':
          return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    };

    it('should calculate 24h range', () => {
      const now = Date.now();
      const start = getStartDate('24h');
      const diff = now - start.getTime();
      // Allow 1 second tolerance
      expect(diff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
      expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    it('should calculate 7d range', () => {
      const now = Date.now();
      const start = getStartDate('7d');
      const diff = now - start.getTime();
      expect(diff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
      expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
    });

    it('should calculate 30d range', () => {
      const now = Date.now();
      const start = getStartDate('30d');
      const diff = now - start.getTime();
      expect(diff).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
      expect(diff).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
    });

    it('should default to 7d for unknown range', () => {
      const now = Date.now();
      const start = getStartDate('unknown');
      const diff = now - start.getTime();
      expect(diff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
      expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('Top Paths Calculation', () => {
    interface Request {
      path: string;
    }

    const getTopPaths = (requests: Request[], limit: number): Array<{ path: string; count: number }> => {
      const pathCounts: Record<string, number> = {};
      requests.forEach((r) => {
        pathCounts[r.path] = (pathCounts[r.path] || 0) + 1;
      });
      return Object.entries(pathCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([path, count]) => ({ path, count }));
    };

    it('should return top paths sorted by count', () => {
      const requests: Request[] = [
        { path: '/api/users' },
        { path: '/api/posts' },
        { path: '/api/users' },
        { path: '/api/users' },
        { path: '/api/comments' },
        { path: '/api/posts' },
      ];

      const topPaths = getTopPaths(requests, 3);
      expect(topPaths[0]).toEqual({ path: '/api/users', count: 3 });
      expect(topPaths[1]).toEqual({ path: '/api/posts', count: 2 });
      expect(topPaths[2]).toEqual({ path: '/api/comments', count: 1 });
    });

    it('should respect limit parameter', () => {
      const requests: Request[] = [
        { path: '/a' },
        { path: '/b' },
        { path: '/c' },
        { path: '/d' },
        { path: '/e' },
      ];

      const topPaths = getTopPaths(requests, 2);
      expect(topPaths.length).toBe(2);
    });
  });
});
