/**
 * Structured logging utilities with request context
 * Provides correlation IDs and consistent log formatting
 */

import crypto from 'crypto';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  duration?: number;
  method?: string;
  path?: string;
  statusCode?: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

// Request context
export interface RequestContext {
  requestId: string;
  startTime: number;
  method: string;
  path: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create a request context from a Request object
 */
export function createRequestContext(request: Request, userId?: string): RequestContext {
  const url = new URL(request.url);

  return {
    requestId: generateRequestId(),
    startTime: Date.now(),
    method: request.method,
    path: url.pathname,
    userId,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * Format a log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.requestId}]`;
  const method = entry.method ? ` ${entry.method}` : '';
  const path = entry.path ? ` ${entry.path}` : '';
  const status = entry.statusCode ? ` -> ${entry.statusCode}` : '';
  const duration = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';

  return `${base}${method}${path}${status}${duration} ${entry.message}`;
}

/**
 * Logger class with context
 */
export class Logger {
  private context: RequestContext;
  private isDevelopment: boolean;

  constructor(context: RequestContext) {
    this.context = context;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.context.requestId,
      message,
      method: this.context.method,
      path: this.context.path,
      userId: this.context.userId,
      ip: this.context.ip,
      userAgent: this.context.userAgent,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    return entry;
  }

  /**
   * Output a log entry
   */
  private output(entry: LogEntry): void {
    const formatted = formatLogEntry(entry);

    if (this.isDevelopment) {
      // Pretty print in development
      switch (entry.level) {
        case 'debug':
          console.debug(formatted, entry.metadata || '');
          break;
        case 'info':
          console.info(formatted, entry.metadata || '');
          break;
        case 'warn':
          console.warn(formatted, entry.metadata || '');
          break;
        case 'error':
          console.error(formatted, entry.error || entry.metadata || '');
          break;
      }
    } else {
      // JSON output in production for log aggregation
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      this.output(this.createEntry('debug', message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry('info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry('warn', message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry('error', message, metadata, error));
  }

  /**
   * Log request completion
   */
  complete(statusCode: number, metadata?: Record<string, unknown>): void {
    const duration = Date.now() - this.context.startTime;
    const entry = this.createEntry(
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      'Request completed',
      metadata
    );
    entry.statusCode = statusCode;
    entry.duration = duration;
    this.output(entry);
  }

  /**
   * Get the request ID for this context
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * Get the duration since request started
   */
  getDuration(): number {
    return Date.now() - this.context.startTime;
  }
}

/**
 * Create a logger from a request
 */
export function createLogger(request: Request, userId?: string): Logger {
  const context = createRequestContext(request, userId);
  return new Logger(context);
}

/**
 * Log a simple message without context
 */
export function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: 'system',
    message,
    metadata,
  };

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry));
  } else {
    console.log(formatLogEntry(entry), metadata || '');
  }
}

/**
 * System logger singleton for non-request contexts
 * Use this for background tasks, startup, shutdown, etc.
 */
export const systemLogger = {
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', message, metadata);
    }
  },

  info(message: string, metadata?: Record<string, unknown>): void {
    log('info', message, metadata);
  },

  warn(message: string, metadata?: Record<string, unknown>): void {
    log('warn', message, metadata);
  },

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorDetails = error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
        }
      : error
        ? { error: String(error) }
        : {};

    log('error', message, { ...metadata, ...errorDetails });
  },
};
