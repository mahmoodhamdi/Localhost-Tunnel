import { describe, it, expect } from 'vitest';

describe('Tunnels List Utilities', () => {
  interface Tunnel {
    id: string;
    subdomain: string;
    localPort: number;
    localHost: string;
    isActive: boolean;
    hasPassword: boolean;
    totalRequests: number;
    lastActiveAt: string;
  }

  const mockTunnels: Tunnel[] = [
    {
      id: '1',
      subdomain: 'my-app',
      localPort: 3000,
      localHost: 'localhost',
      isActive: true,
      hasPassword: false,
      totalRequests: 100,
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: '2',
      subdomain: 'api-server',
      localPort: 8080,
      localHost: 'localhost',
      isActive: false,
      hasPassword: true,
      totalRequests: 50,
      lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      subdomain: 'test-tunnel',
      localPort: 5000,
      localHost: '127.0.0.1',
      isActive: true,
      hasPassword: false,
      totalRequests: 200,
      lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  describe('filterTunnels', () => {
    const filterTunnels = (tunnels: Tunnel[], query: string): Tunnel[] => {
      return tunnels.filter(
        (tunnel) =>
          tunnel.subdomain.toLowerCase().includes(query.toLowerCase()) ||
          tunnel.localPort.toString().includes(query)
      );
    };

    it('should return all tunnels when query is empty', () => {
      const result = filterTunnels(mockTunnels, '');
      expect(result).toHaveLength(3);
    });

    it('should filter by subdomain', () => {
      const result = filterTunnels(mockTunnels, 'api');
      expect(result).toHaveLength(1);
      expect(result[0].subdomain).toBe('api-server');
    });

    it('should filter by port number', () => {
      const result = filterTunnels(mockTunnels, '3000');
      expect(result).toHaveLength(1);
      expect(result[0].localPort).toBe(3000);
    });

    it('should be case insensitive', () => {
      const result = filterTunnels(mockTunnels, 'MY-APP');
      expect(result).toHaveLength(1);
      expect(result[0].subdomain).toBe('my-app');
    });

    it('should return empty array when no match', () => {
      const result = filterTunnels(mockTunnels, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateStats', () => {
    const calculateStats = (tunnels: Tunnel[]) => {
      return {
        total: tunnels.length,
        active: tunnels.filter((t) => t.isActive).length,
        totalRequests: tunnels.reduce((sum, t) => sum + t.totalRequests, 0),
      };
    };

    it('should calculate total tunnels', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.total).toBe(3);
    });

    it('should calculate active tunnels', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.active).toBe(2);
    });

    it('should calculate total requests', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.totalRequests).toBe(350);
    });

    it('should handle empty array', () => {
      const stats = calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('formatDate', () => {
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    };

    it('should return "Just now" for recent dates', () => {
      const now = new Date().toISOString();
      expect(formatDate(now)).toBe('Just now');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(formatDate(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
      expect(formatDate(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString();
      expect(formatDate(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('sortTunnels', () => {
    const sortTunnels = (tunnels: Tunnel[], by: 'requests' | 'lastActive' | 'subdomain'): Tunnel[] => {
      return [...tunnels].sort((a, b) => {
        switch (by) {
          case 'requests':
            return b.totalRequests - a.totalRequests;
          case 'lastActive':
            return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
          case 'subdomain':
            return a.subdomain.localeCompare(b.subdomain);
          default:
            return 0;
        }
      });
    };

    it('should sort by requests descending', () => {
      const sorted = sortTunnels(mockTunnels, 'requests');
      expect(sorted[0].totalRequests).toBe(200);
      expect(sorted[1].totalRequests).toBe(100);
      expect(sorted[2].totalRequests).toBe(50);
    });

    it('should sort by subdomain alphabetically', () => {
      const sorted = sortTunnels(mockTunnels, 'subdomain');
      expect(sorted[0].subdomain).toBe('api-server');
      expect(sorted[1].subdomain).toBe('my-app');
      expect(sorted[2].subdomain).toBe('test-tunnel');
    });

    it('should sort by last active descending', () => {
      const sorted = sortTunnels(mockTunnels, 'lastActive');
      expect(sorted[0].id).toBe('1'); // Most recently active
    });
  });

  describe('deleteTunnel', () => {
    const deleteTunnel = (tunnels: Tunnel[], id: string): Tunnel[] => {
      return tunnels.filter((t) => t.id !== id);
    };

    it('should remove tunnel by id', () => {
      const result = deleteTunnel(mockTunnels, '2');
      expect(result).toHaveLength(2);
      expect(result.find((t) => t.id === '2')).toBeUndefined();
    });

    it('should return same array if id not found', () => {
      const result = deleteTunnel(mockTunnels, 'nonexistent');
      expect(result).toHaveLength(3);
    });
  });
});
