import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, parseIpWhitelist, isIpAllowed } from '../../src/lib/tunnel/auth';

describe('Auth', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'secret123';
      const hash = await hashPassword(password);
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'secret123';
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'secret123';
      const hash = await hashPassword(password);
      const result = await verifyPassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('parseIpWhitelist', () => {
    it('should parse comma-separated IPs', () => {
      const result = parseIpWhitelist('192.168.1.1, 10.0.0.1');
      expect(result).toEqual(['192.168.1.1', '10.0.0.1']);
    });

    it('should return empty array for null/empty', () => {
      expect(parseIpWhitelist(null)).toEqual([]);
      expect(parseIpWhitelist('')).toEqual([]);
    });

    it('should handle CIDR notation', () => {
      const result = parseIpWhitelist('192.168.1.0/24');
      expect(result).toEqual(['192.168.1.0/24']);
    });
  });

  describe('isIpAllowed', () => {
    it('should allow any IP when whitelist is empty', () => {
      expect(isIpAllowed('192.168.1.1', [])).toBe(true);
    });

    it('should allow whitelisted IP', () => {
      expect(isIpAllowed('192.168.1.1', ['192.168.1.1'])).toBe(true);
    });

    it('should reject non-whitelisted IP', () => {
      expect(isIpAllowed('192.168.1.2', ['192.168.1.1'])).toBe(false);
    });

    it('should handle CIDR ranges', () => {
      expect(isIpAllowed('192.168.1.50', ['192.168.1.0/24'])).toBe(true);
      expect(isIpAllowed('192.168.2.1', ['192.168.1.0/24'])).toBe(false);
    });
  });
});
