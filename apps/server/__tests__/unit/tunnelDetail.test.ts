import { describe, it, expect } from 'vitest';

describe('Tunnel Detail Utilities', () => {
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
      expect(formatBytes(5242880)).toBe('5 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('getTimeAgo', () => {
    const getTimeAgo = (dateString: string): string => {
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
      expect(getTimeAgo(now)).toBe('Just now');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(getTimeAgo(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
      expect(getTimeAgo(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString();
      expect(getTimeAgo(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('Tunnel Data Validation', () => {
    interface TunnelData {
      id: string;
      subdomain: string;
      publicUrl: string;
      localPort: number;
      localHost: string;
      isActive: boolean;
    }

    const validateTunnelData = (data: Partial<TunnelData>): boolean => {
      if (!data.id || typeof data.id !== 'string') return false;
      if (!data.subdomain || typeof data.subdomain !== 'string') return false;
      if (!data.localPort || data.localPort < 1 || data.localPort > 65535) return false;
      return true;
    };

    it('should validate valid tunnel data', () => {
      const validData: Partial<TunnelData> = {
        id: 'test-id',
        subdomain: 'my-tunnel',
        localPort: 3000,
      };
      expect(validateTunnelData(validData)).toBe(true);
    });

    it('should reject missing id', () => {
      const invalidData: Partial<TunnelData> = {
        subdomain: 'my-tunnel',
        localPort: 3000,
      };
      expect(validateTunnelData(invalidData)).toBe(false);
    });

    it('should reject missing subdomain', () => {
      const invalidData: Partial<TunnelData> = {
        id: 'test-id',
        localPort: 3000,
      };
      expect(validateTunnelData(invalidData)).toBe(false);
    });

    it('should reject invalid port', () => {
      const invalidData: Partial<TunnelData> = {
        id: 'test-id',
        subdomain: 'my-tunnel',
        localPort: 70000,
      };
      expect(validateTunnelData(invalidData)).toBe(false);
    });

    it('should reject port 0', () => {
      const invalidData: Partial<TunnelData> = {
        id: 'test-id',
        subdomain: 'my-tunnel',
        localPort: 0,
      };
      expect(validateTunnelData(invalidData)).toBe(false);
    });
  });

  describe('Public URL Generation', () => {
    const generatePublicUrl = (subdomain: string, domain: string): string => {
      return `http://${subdomain}.${domain}`;
    };

    it('should generate correct public URL', () => {
      expect(generatePublicUrl('my-app', 'localhost:3000')).toBe('http://my-app.localhost:3000');
    });

    it('should handle production domain', () => {
      expect(generatePublicUrl('my-app', 'tunnel.example.com')).toBe('http://my-app.tunnel.example.com');
    });
  });

  describe('Status Badge Logic', () => {
    const getStatusBadge = (isActive: boolean, expiresAt: string | null): string => {
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return 'expired';
      }
      return isActive ? 'active' : 'inactive';
    };

    it('should return active for active tunnel', () => {
      expect(getStatusBadge(true, null)).toBe('active');
    });

    it('should return inactive for inactive tunnel', () => {
      expect(getStatusBadge(false, null)).toBe('inactive');
    });

    it('should return expired for expired tunnel', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(getStatusBadge(true, pastDate)).toBe('expired');
    });

    it('should return active for non-expired tunnel', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      expect(getStatusBadge(true, futureDate)).toBe('active');
    });
  });
});
