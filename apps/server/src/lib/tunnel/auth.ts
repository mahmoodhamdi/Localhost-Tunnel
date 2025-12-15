import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function parseIpWhitelist(whitelist: string | null): string[] {
  if (!whitelist || whitelist.trim() === '') {
    return [];
  }

  return whitelist
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);
}

export function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    return true;
  }

  // Normalize IP
  const normalizedIp = normalizeIp(ip);

  for (const allowed of whitelist) {
    if (allowed.includes('/')) {
      // CIDR notation
      if (isIpInCidr(normalizedIp, allowed)) {
        return true;
      }
    } else if (normalizedIp === normalizeIp(allowed)) {
      return true;
    }
  }

  return false;
}

function normalizeIp(ip: string): string {
  // Handle IPv6-mapped IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  // Handle localhost variations
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);

    // Validate CIDR bits (must be 0-32)
    if (isNaN(bits) || bits < 0 || bits > 32) {
      return false;
    }

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    // Return false if either IP is invalid
    if (ipNum === null || rangeNum === null) {
      return false;
    }

    // Calculate mask using bit shifting (more reliable than exponentiation)
    // For bits=0, mask should be 0; for bits=32, mask should be all 1s
    const mask = bits === 0 ? 0 : ((-1 << (32 - bits)) >>> 0);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);

  // Validate IPv4 format
  if (parts.length !== 4) {
    return null;
  }

  // Validate each octet
  for (const part of parts) {
    if (isNaN(part) || part < 0 || part > 255) {
      return null;
    }
  }

  // Calculate IP number using multiplication instead of bit shifting
  // to avoid JavaScript's 32-bit signed integer issues
  return (parts[0] * 16777216) + (parts[1] * 65536) + (parts[2] * 256) + parts[3];
}
