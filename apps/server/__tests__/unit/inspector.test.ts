import { describe, it, expect } from 'vitest';

describe('Inspector Utilities', () => {
  interface RequestLog {
    id: string;
    method: string;
    path: string;
    statusCode: number | null;
    responseTime: number | null;
    createdAt: string;
  }

  const mockRequests: RequestLog[] = [
    { id: '1', method: 'GET', path: '/api/users', statusCode: 200, responseTime: 50, createdAt: new Date().toISOString() },
    { id: '2', method: 'POST', path: '/api/users', statusCode: 201, responseTime: 100, createdAt: new Date().toISOString() },
    { id: '3', method: 'GET', path: '/api/posts', statusCode: 404, responseTime: 30, createdAt: new Date().toISOString() },
    { id: '4', method: 'DELETE', path: '/api/users/1', statusCode: 500, responseTime: 200, createdAt: new Date().toISOString() },
  ];

  describe('getMethodColor', () => {
    const getMethodColor = (method: string): string => {
      switch (method) {
        case 'GET': return 'bg-green-500';
        case 'POST': return 'bg-blue-500';
        case 'PUT': return 'bg-yellow-500';
        case 'PATCH': return 'bg-orange-500';
        case 'DELETE': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    };

    it('should return correct colors for methods', () => {
      expect(getMethodColor('GET')).toBe('bg-green-500');
      expect(getMethodColor('POST')).toBe('bg-blue-500');
      expect(getMethodColor('PUT')).toBe('bg-yellow-500');
      expect(getMethodColor('PATCH')).toBe('bg-orange-500');
      expect(getMethodColor('DELETE')).toBe('bg-red-500');
      expect(getMethodColor('OPTIONS')).toBe('bg-gray-500');
    });
  });

  describe('getStatusColor', () => {
    const getStatusColor = (status: number | null): string => {
      if (!status) return 'text-muted-foreground';
      if (status >= 200 && status < 300) return 'text-green-500';
      if (status >= 300 && status < 400) return 'text-blue-500';
      if (status >= 400 && status < 500) return 'text-yellow-500';
      if (status >= 500) return 'text-red-500';
      return 'text-muted-foreground';
    };

    it('should return correct colors for status codes', () => {
      expect(getStatusColor(200)).toBe('text-green-500');
      expect(getStatusColor(201)).toBe('text-green-500');
      expect(getStatusColor(301)).toBe('text-blue-500');
      expect(getStatusColor(404)).toBe('text-yellow-500');
      expect(getStatusColor(500)).toBe('text-red-500');
      expect(getStatusColor(null)).toBe('text-muted-foreground');
    });
  });

  describe('filterRequests', () => {
    const filterRequests = (
      requests: RequestLog[],
      query: string,
      method: string,
      status: string
    ): RequestLog[] => {
      return requests.filter((r) => {
        const matchesQuery = r.path.toLowerCase().includes(query.toLowerCase());
        const matchesMethod = method === 'all' || r.method === method;
        const matchesStatus = status === 'all' || (
          r.statusCode !== null &&
          Math.floor(r.statusCode / 100).toString() === status[0]
        );
        return matchesQuery && matchesMethod && matchesStatus;
      });
    };

    it('should filter by path query', () => {
      const result = filterRequests(mockRequests, 'users', 'all', 'all');
      expect(result.length).toBe(3);
    });

    it('should filter by method', () => {
      const result = filterRequests(mockRequests, '', 'GET', 'all');
      expect(result.length).toBe(2);
    });

    it('should filter by status', () => {
      const result = filterRequests(mockRequests, '', 'all', '2xx');
      expect(result.length).toBe(2);
    });

    it('should combine filters', () => {
      const result = filterRequests(mockRequests, 'users', 'GET', '2xx');
      expect(result.length).toBe(1);
    });
  });

  describe('HAR Export', () => {
    const createHarEntry = (request: RequestLog) => ({
      startedDateTime: request.createdAt,
      time: request.responseTime || 0,
      request: {
        method: request.method,
        url: request.path,
      },
      response: {
        status: request.statusCode || 0,
      },
    });

    it('should create HAR entry from request', () => {
      const entry = createHarEntry(mockRequests[0]);
      expect(entry.request.method).toBe('GET');
      expect(entry.request.url).toBe('/api/users');
      expect(entry.response.status).toBe(200);
      expect(entry.time).toBe(50);
    });

    it('should handle null status code', () => {
      const request = { ...mockRequests[0], statusCode: null };
      const entry = createHarEntry(request);
      expect(entry.response.status).toBe(0);
    });

    it('should handle null response time', () => {
      const request = { ...mockRequests[0], responseTime: null };
      const entry = createHarEntry(request);
      expect(entry.time).toBe(0);
    });
  });

  describe('formatDate', () => {
    const formatDate = (dateString: string): string => {
      return new Date(dateString).toLocaleTimeString();
    };

    it('should format date to time string', () => {
      const date = new Date('2024-01-15T14:30:45Z');
      const formatted = formatDate(date.toISOString());
      // Just verify it returns a string (format varies by locale)
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('Request Statistics', () => {
    const calculateStats = (requests: RequestLog[]) => {
      const total = requests.length;
      const successful = requests.filter(r => r.statusCode && r.statusCode >= 200 && r.statusCode < 400).length;
      const failed = requests.filter(r => r.statusCode && r.statusCode >= 400).length;
      const avgResponseTime = requests.length > 0
        ? Math.round(requests.reduce((sum, r) => sum + (r.responseTime || 0), 0) / requests.length)
        : 0;

      return { total, successful, failed, avgResponseTime };
    };

    it('should calculate request statistics', () => {
      const stats = calculateStats(mockRequests);
      expect(stats.total).toBe(4);
      expect(stats.successful).toBe(2); // 200, 201
      expect(stats.failed).toBe(2); // 404, 500
      expect(stats.avgResponseTime).toBe(95); // (50+100+30+200)/4
    });

    it('should handle empty array', () => {
      const stats = calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
    });
  });
});
