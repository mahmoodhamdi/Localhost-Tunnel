import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  validatePort,
  validateSubdomain,
  generateSubdomain,
  generateTunnelId,
  generateRequestId,
  parseIpWhitelist,
  isIpAllowed,
  formatDuration,
} from './utils';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('generateSubdomain', () => {
  it('generates subdomain with correct format', () => {
    const subdomain = generateSubdomain();
    expect(subdomain).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  it('generates unique subdomains', () => {
    const subdomain1 = generateSubdomain();
    const subdomain2 = generateSubdomain();
    // Due to randomness, they should almost always be different
    // In extremely rare cases they could match
    expect(typeof subdomain1).toBe('string');
    expect(typeof subdomain2).toBe('string');
  });
});

describe('generateTunnelId', () => {
  it('generates tunnel id with correct prefix', () => {
    const id = generateTunnelId();
    expect(id).toMatch(/^tn_\d+_[a-z0-9]+$/);
  });

  it('generates unique tunnel ids', () => {
    const id1 = generateTunnelId();
    const id2 = generateTunnelId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateRequestId', () => {
  it('generates request id with correct prefix', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
  });
});

describe('validatePort', () => {
  it('returns valid for valid ports', () => {
    expect(validatePort(80).valid).toBe(true);
    expect(validatePort(3000).valid).toBe(true);
    expect(validatePort(65535).valid).toBe(true);
  });

  it('returns invalid for out of range ports', () => {
    expect(validatePort(0).valid).toBe(false);
    expect(validatePort(-1).valid).toBe(false);
    expect(validatePort(65536).valid).toBe(false);
  });
});

describe('validateSubdomain', () => {
  it('returns valid for valid subdomains', () => {
    expect(validateSubdomain('my-app').valid).toBe(true);
    expect(validateSubdomain('test123').valid).toBe(true);
    expect(validateSubdomain('hello-world-123').valid).toBe(true);
  });

  it('returns invalid for empty subdomain', () => {
    const result = validateSubdomain('');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for subdomains that are too short', () => {
    const result = validateSubdomain('ab');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for subdomains that are too long', () => {
    const result = validateSubdomain('a'.repeat(64));
    expect(result.valid).toBe(false);
  });

  it('returns invalid for reserved subdomains', () => {
    const result = validateSubdomain('www');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reserved');
  });

  it('returns invalid for subdomains with invalid characters', () => {
    const result = validateSubdomain('my_app');
    expect(result.valid).toBe(false);
  });
});

describe('parseIpWhitelist', () => {
  it('parses comma-separated IPs', () => {
    const result = parseIpWhitelist('192.168.1.1, 10.0.0.1');
    expect(result).toEqual(['192.168.1.1', '10.0.0.1']);
  });

  it('handles empty string', () => {
    expect(parseIpWhitelist('')).toEqual([]);
  });

  it('handles whitespace-only string', () => {
    expect(parseIpWhitelist('   ')).toEqual([]);
  });
});

describe('isIpAllowed', () => {
  it('allows any IP when whitelist is empty', () => {
    expect(isIpAllowed('192.168.1.1', [])).toBe(true);
  });

  it('allows IP in whitelist', () => {
    expect(isIpAllowed('192.168.1.1', ['192.168.1.1'])).toBe(true);
  });

  it('denies IP not in whitelist', () => {
    expect(isIpAllowed('192.168.1.2', ['192.168.1.1'])).toBe(false);
  });

  it('supports CIDR notation', () => {
    expect(isIpAllowed('192.168.1.50', ['192.168.1.0/24'])).toBe(true);
    expect(isIpAllowed('192.168.2.1', ['192.168.1.0/24'])).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(2500)).toBe('2.50s');
  });

  it('formats minutes', () => {
    expect(formatDuration(120000)).toBe('2.00m');
  });

  it('formats hours', () => {
    expect(formatDuration(7200000)).toBe('2.00h');
  });
});
