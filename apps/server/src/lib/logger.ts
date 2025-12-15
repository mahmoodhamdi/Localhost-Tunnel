/**
 * Simple logger for server-side operations
 * Used by modules that don't have request context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, data));
    }
  },

  info(message: string, data?: unknown): void {
    console.info(formatMessage('info', message, data));
  },

  warn(message: string, data?: unknown): void {
    console.warn(formatMessage('warn', message, data));
  },

  error(message: string, data?: unknown): void {
    console.error(formatMessage('error', message, data));
  },
};
