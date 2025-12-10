import { SUBDOMAIN } from '@localhost-tunnel/shared';

const adjectives = [
  'happy', 'clever', 'swift', 'bright', 'calm', 'eager', 'fair', 'gentle',
  'jolly', 'kind', 'lively', 'nice', 'proud', 'quick', 'smart', 'witty',
  'bold', 'cool', 'epic', 'fast', 'good', 'keen', 'neat', 'wise',
];

const nouns = [
  'tunnel', 'bridge', 'portal', 'gate', 'link', 'path', 'route', 'channel',
  'stream', 'flow', 'pipe', 'way', 'road', 'lane', 'trail', 'track',
  'node', 'hub', 'point', 'spot', 'zone', 'area', 'dock', 'port',
];

export function generateSubdomain(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}-${noun}-${number}`;
}

export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain) {
    return { valid: false, error: 'Subdomain is required' };
  }

  const normalizedSubdomain = subdomain.toLowerCase().trim();

  if (normalizedSubdomain.length < SUBDOMAIN.MIN_LENGTH) {
    return { valid: false, error: `Subdomain must be at least ${SUBDOMAIN.MIN_LENGTH} characters` };
  }

  if (normalizedSubdomain.length > SUBDOMAIN.MAX_LENGTH) {
    return { valid: false, error: `Subdomain must be at most ${SUBDOMAIN.MAX_LENGTH} characters` };
  }

  if (!SUBDOMAIN.PATTERN.test(normalizedSubdomain)) {
    return { valid: false, error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' };
  }

  if ((SUBDOMAIN.RESERVED as readonly string[]).includes(normalizedSubdomain)) {
    return { valid: false, error: 'This subdomain is reserved' };
  }

  return { valid: true };
}

export function normalizeSubdomain(subdomain: string): string {
  return subdomain.toLowerCase().trim();
}
