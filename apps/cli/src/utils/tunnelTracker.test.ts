import { describe, it, expect, beforeEach } from 'vitest';
import { registerTunnel, unregisterTunnel, getActiveTunnels, clearAllTunnels } from './tunnelTracker.js';

describe('tunnelTracker', () => {
  beforeEach(() => {
    // Clear all tunnels before each test
    clearAllTunnels();
  });

  describe('registerTunnel', () => {
    it('should register a new tunnel', () => {
      registerTunnel({
        subdomain: 'test-subdomain',
        publicUrl: 'https://test-subdomain.localhost:7000',
        localPort: 3000,
        localHost: 'localhost',
      });

      const tunnels = getActiveTunnels();
      expect(tunnels).toHaveLength(1);
      expect(tunnels[0].subdomain).toBe('test-subdomain');
      expect(tunnels[0].publicUrl).toBe('https://test-subdomain.localhost:7000');
      expect(tunnels[0].localPort).toBe(3000);
      expect(tunnels[0].localHost).toBe('localhost');
      expect(tunnels[0].pid).toBe(process.pid);
      expect(tunnels[0].startedAt).toBeDefined();
    });

    it('should overwrite existing tunnel from same process', () => {
      registerTunnel({
        subdomain: 'old-subdomain',
        publicUrl: 'https://old-subdomain.localhost:7000',
        localPort: 3000,
        localHost: 'localhost',
      });

      registerTunnel({
        subdomain: 'new-subdomain',
        publicUrl: 'https://new-subdomain.localhost:7000',
        localPort: 4000,
        localHost: 'localhost',
      });

      const tunnels = getActiveTunnels();
      expect(tunnels).toHaveLength(1);
      expect(tunnels[0].subdomain).toBe('new-subdomain');
      expect(tunnels[0].localPort).toBe(4000);
    });
  });

  describe('unregisterTunnel', () => {
    it('should remove tunnel for current process', () => {
      registerTunnel({
        subdomain: 'test-subdomain',
        publicUrl: 'https://test-subdomain.localhost:7000',
        localPort: 3000,
        localHost: 'localhost',
      });

      expect(getActiveTunnels()).toHaveLength(1);

      unregisterTunnel();

      expect(getActiveTunnels()).toHaveLength(0);
    });

    it('should not fail when no tunnel is registered', () => {
      expect(() => unregisterTunnel()).not.toThrow();
    });
  });

  describe('getActiveTunnels', () => {
    it('should return empty array when no tunnels', () => {
      expect(getActiveTunnels()).toEqual([]);
    });

    it('should return registered tunnels', () => {
      registerTunnel({
        subdomain: 'test-subdomain',
        publicUrl: 'https://test-subdomain.localhost:7000',
        localPort: 3000,
        localHost: 'localhost',
      });

      const tunnels = getActiveTunnels();
      expect(tunnels).toHaveLength(1);
    });
  });

  describe('clearAllTunnels', () => {
    it('should remove all tunnels', () => {
      registerTunnel({
        subdomain: 'test-subdomain-1',
        publicUrl: 'https://test-subdomain-1.localhost:7000',
        localPort: 3000,
        localHost: 'localhost',
      });

      clearAllTunnels();

      expect(getActiveTunnels()).toHaveLength(0);
    });
  });
});
