import { describe, it, expect } from 'vitest';
import { generateSubdomain, validateSubdomain } from '../../src/lib/tunnel/subdomain';

describe('Subdomain', () => {
  describe('generateSubdomain', () => {
    it('should generate a valid subdomain', () => {
      const subdomain = generateSubdomain();
      expect(subdomain).toBeTruthy();
      expect(subdomain.length).toBeGreaterThanOrEqual(3);
      expect(/^[a-z0-9-]+$/.test(subdomain)).toBe(true);
    });

    it('should generate unique subdomains', () => {
      const subdomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        subdomains.add(generateSubdomain());
      }
      // Should have high uniqueness
      expect(subdomains.size).toBeGreaterThan(90);
    });
  });

  describe('validateSubdomain', () => {
    it('should accept valid subdomains', () => {
      expect(validateSubdomain('my-app').valid).toBe(true);
      expect(validateSubdomain('test123').valid).toBe(true);
      expect(validateSubdomain('hello-world-123').valid).toBe(true);
    });

    it('should reject empty subdomain', () => {
      const result = validateSubdomain('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject too short subdomain', () => {
      const result = validateSubdomain('ab');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(validateSubdomain('my_app').valid).toBe(false);
      expect(validateSubdomain('my.app').valid).toBe(false);
      expect(validateSubdomain('my@app').valid).toBe(false);
    });

    it('should normalize uppercase to lowercase and accept', () => {
      // The validation function normalizes to lowercase before validating
      expect(validateSubdomain('MY-APP').valid).toBe(true);
      expect(validateSubdomain('Test123').valid).toBe(true);
    });

    it('should reject reserved subdomains', () => {
      expect(validateSubdomain('www').valid).toBe(false);
      expect(validateSubdomain('api').valid).toBe(false);
      expect(validateSubdomain('admin').valid).toBe(false);
    });
  });
});
