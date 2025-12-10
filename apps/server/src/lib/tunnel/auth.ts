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
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
