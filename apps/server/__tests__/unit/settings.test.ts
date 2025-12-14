import { describe, it, expect } from 'vitest';

describe('Settings Utilities', () => {
  interface Settings {
    defaultPort: number;
    defaultSubdomain: string;
    autoReconnect: boolean;
    keepHistory: number;
    maxRequests: number;
    requirePassword: boolean;
    defaultExpiration: string;
    rateLimit: number;
  }

  const DEFAULT_SETTINGS: Settings = {
    defaultPort: 3000,
    defaultSubdomain: '',
    autoReconnect: true,
    keepHistory: 7,
    maxRequests: 1000,
    requirePassword: false,
    defaultExpiration: 'never',
    rateLimit: 100,
  };

  describe('Port Validation', () => {
    const validatePort = (port: number): boolean => {
      return port >= 1 && port <= 65535;
    };

    it('should validate valid ports', () => {
      expect(validatePort(1)).toBe(true);
      expect(validatePort(80)).toBe(true);
      expect(validatePort(3000)).toBe(true);
      expect(validatePort(8080)).toBe(true);
      expect(validatePort(65535)).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(validatePort(0)).toBe(false);
      expect(validatePort(-1)).toBe(false);
      expect(validatePort(65536)).toBe(false);
      expect(validatePort(100000)).toBe(false);
    });
  });

  describe('Keep History Validation', () => {
    const validateKeepHistory = (days: number): boolean => {
      return days >= 1 && days <= 365;
    };

    it('should validate valid days', () => {
      expect(validateKeepHistory(1)).toBe(true);
      expect(validateKeepHistory(7)).toBe(true);
      expect(validateKeepHistory(30)).toBe(true);
      expect(validateKeepHistory(365)).toBe(true);
    });

    it('should reject invalid days', () => {
      expect(validateKeepHistory(0)).toBe(false);
      expect(validateKeepHistory(-1)).toBe(false);
      expect(validateKeepHistory(366)).toBe(false);
      expect(validateKeepHistory(1000)).toBe(false);
    });
  });

  describe('Max Requests Validation', () => {
    const validateMaxRequests = (requests: number): boolean => {
      return requests >= 100 && requests <= 100000;
    };

    it('should validate valid request limits', () => {
      expect(validateMaxRequests(100)).toBe(true);
      expect(validateMaxRequests(1000)).toBe(true);
      expect(validateMaxRequests(10000)).toBe(true);
      expect(validateMaxRequests(100000)).toBe(true);
    });

    it('should reject invalid request limits', () => {
      expect(validateMaxRequests(99)).toBe(false);
      expect(validateMaxRequests(0)).toBe(false);
      expect(validateMaxRequests(100001)).toBe(false);
      expect(validateMaxRequests(-100)).toBe(false);
    });
  });

  describe('Rate Limit Validation', () => {
    const validateRateLimit = (limit: number): boolean => {
      return limit >= 0 && limit <= 10000;
    };

    it('should validate valid rate limits', () => {
      expect(validateRateLimit(0)).toBe(true);
      expect(validateRateLimit(100)).toBe(true);
      expect(validateRateLimit(1000)).toBe(true);
      expect(validateRateLimit(10000)).toBe(true);
    });

    it('should reject invalid rate limits', () => {
      expect(validateRateLimit(-1)).toBe(false);
      expect(validateRateLimit(10001)).toBe(false);
    });
  });

  describe('Expiration Validation', () => {
    const VALID_EXPIRATIONS = ['never', '3600', '21600', '86400', '604800'];

    const validateExpiration = (expiration: string): boolean => {
      return VALID_EXPIRATIONS.includes(expiration);
    };

    it('should validate valid expirations', () => {
      expect(validateExpiration('never')).toBe(true);
      expect(validateExpiration('3600')).toBe(true);
      expect(validateExpiration('21600')).toBe(true);
      expect(validateExpiration('86400')).toBe(true);
      expect(validateExpiration('604800')).toBe(true);
    });

    it('should reject invalid expirations', () => {
      expect(validateExpiration('invalid')).toBe(false);
      expect(validateExpiration('1000')).toBe(false);
      expect(validateExpiration('')).toBe(false);
    });
  });

  describe('Settings Merge', () => {
    const mergeSettings = (current: Settings, updates: Partial<Settings>): Settings => {
      return { ...current, ...updates };
    };

    it('should merge partial updates', () => {
      const result = mergeSettings(DEFAULT_SETTINGS, { defaultPort: 8080 });
      expect(result.defaultPort).toBe(8080);
      expect(result.autoReconnect).toBe(true);
      expect(result.keepHistory).toBe(7);
    });

    it('should override multiple fields', () => {
      const result = mergeSettings(DEFAULT_SETTINGS, {
        defaultPort: 4000,
        rateLimit: 200,
        requirePassword: true,
      });
      expect(result.defaultPort).toBe(4000);
      expect(result.rateLimit).toBe(200);
      expect(result.requirePassword).toBe(true);
    });

    it('should preserve unchanged fields', () => {
      const result = mergeSettings(DEFAULT_SETTINGS, {});
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Settings Serialization', () => {
    const serializeSettings = (settings: Settings): Record<string, string | boolean> => {
      return {
        defaultPort: settings.defaultPort.toString(),
        defaultSubdomain: settings.defaultSubdomain,
        autoReconnect: settings.autoReconnect,
        keepHistory: settings.keepHistory.toString(),
        maxRequests: settings.maxRequests.toString(),
        requirePassword: settings.requirePassword,
        defaultExpiration: settings.defaultExpiration,
        rateLimit: settings.rateLimit.toString(),
      };
    };

    it('should serialize settings to strings for form use', () => {
      const serialized = serializeSettings(DEFAULT_SETTINGS);
      expect(serialized.defaultPort).toBe('3000');
      expect(serialized.keepHistory).toBe('7');
      expect(serialized.maxRequests).toBe('1000');
      expect(serialized.rateLimit).toBe('100');
    });

    it('should preserve boolean and string values', () => {
      const serialized = serializeSettings(DEFAULT_SETTINGS);
      expect(serialized.autoReconnect).toBe(true);
      expect(serialized.requirePassword).toBe(false);
      expect(serialized.defaultExpiration).toBe('never');
    });
  });

  describe('Settings Deserialization', () => {
    const deserializeSettings = (data: Record<string, string | boolean>): Settings => {
      return {
        defaultPort: parseInt(data.defaultPort as string, 10),
        defaultSubdomain: data.defaultSubdomain as string,
        autoReconnect: data.autoReconnect as boolean,
        keepHistory: parseInt(data.keepHistory as string, 10),
        maxRequests: parseInt(data.maxRequests as string, 10),
        requirePassword: data.requirePassword as boolean,
        defaultExpiration: data.defaultExpiration as string,
        rateLimit: parseInt(data.rateLimit as string, 10),
      };
    };

    it('should deserialize form data back to settings', () => {
      const formData = {
        defaultPort: '8080',
        defaultSubdomain: 'my-app',
        autoReconnect: true,
        keepHistory: '30',
        maxRequests: '5000',
        requirePassword: true,
        defaultExpiration: '86400',
        rateLimit: '500',
      };

      const settings = deserializeSettings(formData);
      expect(settings.defaultPort).toBe(8080);
      expect(settings.defaultSubdomain).toBe('my-app');
      expect(settings.keepHistory).toBe(30);
      expect(settings.maxRequests).toBe(5000);
      expect(settings.rateLimit).toBe(500);
    });
  });
});
