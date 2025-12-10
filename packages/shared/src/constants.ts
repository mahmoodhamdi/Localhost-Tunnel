// Default configuration values
export const DEFAULTS = {
  LOCAL_HOST: 'localhost',
  LOCAL_PORT: 3000,
  SERVER_PORT: 3000,
  TUNNEL_PORT: 7000,
  MAX_TUNNELS: 10,
  MAX_REQUESTS: 1000,
  TUNNEL_TIMEOUT: 3600, // seconds
  RATE_LIMIT: 100, // requests per minute
  KEEP_HISTORY_DAYS: 7,
  RECONNECT_INTERVAL: 5000, // ms
  PING_INTERVAL: 30000, // ms
  REQUEST_TIMEOUT: 30000, // ms
} as const;

// Error codes
export const ERROR_CODES = {
  // Tunnel errors
  TUNNEL_NOT_FOUND: 'TUNNEL_NOT_FOUND',
  SUBDOMAIN_TAKEN: 'SUBDOMAIN_TAKEN',
  INVALID_PORT: 'INVALID_PORT',
  PORT_IN_USE: 'PORT_IN_USE',
  MAX_TUNNELS_REACHED: 'MAX_TUNNELS_REACHED',
  TUNNEL_EXPIRED: 'TUNNEL_EXPIRED',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  PASSWORD_INCORRECT: 'PASSWORD_INCORRECT',
  IP_BLOCKED: 'IP_BLOCKED',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_CLOSED: 'CONNECTION_CLOSED',
  LOCAL_SERVER_NOT_RUNNING: 'LOCAL_SERVER_NOT_RUNNING',

  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// Subdomain configuration
export const SUBDOMAIN = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 63,
  PATTERN: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
  RESERVED: [
    'www',
    'api',
    'admin',
    'dashboard',
    'app',
    'mail',
    'ftp',
    'ssh',
    'git',
    'tunnel',
    'ws',
    'wss',
    'http',
    'https',
  ],
} as const;

// HTTP methods
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

// Supported locales
export const LOCALES = ['en', 'ar'] as const;
export const DEFAULT_LOCALE = 'en' as const;

// Tunnel expiration options (in seconds)
export const EXPIRATION_OPTIONS = {
  NEVER: null,
  ONE_HOUR: 3600,
  SIX_HOURS: 21600,
  ONE_DAY: 86400,
  SEVEN_DAYS: 604800,
} as const;
