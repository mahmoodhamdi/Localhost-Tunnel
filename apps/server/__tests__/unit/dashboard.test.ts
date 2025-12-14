import { describe, it, expect } from 'vitest';

describe('Dashboard Utilities', () => {
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

    it('should format bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDate', () => {
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);

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
  });

  describe('getStatusColor', () => {
    const getStatusColor = (statusCode: number | null): string => {
      if (!statusCode) return 'text-muted-foreground';
      if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
      if (statusCode >= 400 && statusCode < 500) return 'text-yellow-500';
      if (statusCode >= 500) return 'text-red-500';
      return 'text-muted-foreground';
    };

    it('should return muted for null status', () => {
      expect(getStatusColor(null)).toBe('text-muted-foreground');
    });

    it('should return green for 2xx status', () => {
      expect(getStatusColor(200)).toBe('text-green-500');
      expect(getStatusColor(201)).toBe('text-green-500');
      expect(getStatusColor(299)).toBe('text-green-500');
    });

    it('should return yellow for 4xx status', () => {
      expect(getStatusColor(400)).toBe('text-yellow-500');
      expect(getStatusColor(404)).toBe('text-yellow-500');
      expect(getStatusColor(499)).toBe('text-yellow-500');
    });

    it('should return red for 5xx status', () => {
      expect(getStatusColor(500)).toBe('text-red-500');
      expect(getStatusColor(503)).toBe('text-red-500');
    });

    it('should return muted for other status codes', () => {
      expect(getStatusColor(100)).toBe('text-muted-foreground');
      expect(getStatusColor(301)).toBe('text-muted-foreground');
    });
  });

  describe('Dashboard Stats Calculation', () => {
    interface Tunnel {
      isActive: boolean;
      totalRequests: number;
      totalBytes: number;
    }

    const calculateStats = (tunnels: Tunnel[]) => {
      const activeTunnels = tunnels.filter((t) => t.isActive).length;
      const totalTunnels = tunnels.length;
      const totalRequests = tunnels.reduce((sum, t) => sum + t.totalRequests, 0);
      const totalBytes = tunnels.reduce((sum, t) => sum + t.totalBytes, 0);
      const uptime = totalTunnels > 0 ? Math.round((activeTunnels / totalTunnels) * 100) : 100;

      return { activeTunnels, totalTunnels, totalRequests, totalBytes, uptime };
    };

    const mockTunnels: Tunnel[] = [
      { isActive: true, totalRequests: 100, totalBytes: 1024 },
      { isActive: false, totalRequests: 50, totalBytes: 512 },
      { isActive: true, totalRequests: 200, totalBytes: 2048 },
    ];

    it('should calculate active tunnels', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.activeTunnels).toBe(2);
    });

    it('should calculate total tunnels', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.totalTunnels).toBe(3);
    });

    it('should calculate total requests', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.totalRequests).toBe(350);
    });

    it('should calculate total bytes', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.totalBytes).toBe(3584);
    });

    it('should calculate uptime percentage', () => {
      const stats = calculateStats(mockTunnels);
      expect(stats.uptime).toBe(67); // 2/3 = 66.67% rounded to 67
    });

    it('should return 100% uptime for empty array', () => {
      const stats = calculateStats([]);
      expect(stats.uptime).toBe(100);
    });
  });
});
