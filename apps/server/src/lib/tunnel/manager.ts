import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
  MessageType,
  type WSMessage,
  type RequestMessage,
  type ResponseMessage,
  generateRequestId,
} from '@localhost-tunnel/shared';
import { prisma } from '../db/prisma';
import { generateSubdomain, validateSubdomain, normalizeSubdomain } from './subdomain';
import { hashPassword, verifyPassword, parseIpWhitelist, isIpAllowed } from './auth';
import { systemLogger } from '../api/logger';

interface TunnelConnection {
  id: string;
  subdomain: string;
  ws: WebSocket;
  localPort: number;
  localHost: string;
  createdAt: Date;
  pendingRequests: Map<string, {
    resolve: (response: ResponseMessage['payload']) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  // Cached data to avoid database queries on every request
  expiresAt: Date | null;
  ipWhitelist: string[];
  pingInterval: NodeJS.Timeout | null;
}

interface CreateTunnelOptions {
  subdomain?: string;
  localPort: number;
  localHost?: string;
  password?: string;
  ipWhitelist?: string;
  expiresAt?: Date | null;
  inspect?: boolean;
}

interface PasswordAttempt {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

// In-memory stats for batched database updates
interface TunnelStats {
  requestCount: number;
  bytesCount: number;
  lastActiveAt: Date;
}

// Rate limiting configuration for password verification
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,           // Max attempts before lockout
  baseDelay: 1000,          // Base delay in ms (1 second)
  maxDelay: 300000,         // Max delay of 5 minutes
  cleanupInterval: 3600000, // Cleanup old entries every hour
};

// Stats flush configuration
const STATS_FLUSH_CONFIG = {
  flushInterval: 5000,      // Flush stats every 5 seconds
  maxBatchSize: 100,        // Maximum tunnels to update in one batch
};

// Maximum request body size (10MB)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

// Request timeout configuration
const REQUEST_TIMEOUT_CONFIG = {
  default: 30000, // 30 seconds default
  min: 5000, // 5 seconds minimum
  max: 300000, // 5 minutes maximum
};

// Get request timeout from environment variable
function getRequestTimeout(): number {
  const envTimeout = process.env.TUNNEL_REQUEST_TIMEOUT;
  if (!envTimeout) {
    return REQUEST_TIMEOUT_CONFIG.default;
  }

  const timeout = parseInt(envTimeout, 10);
  if (isNaN(timeout)) {
    systemLogger.warn(`Invalid TUNNEL_REQUEST_TIMEOUT value: ${envTimeout}, using default`);
    return REQUEST_TIMEOUT_CONFIG.default;
  }

  // Clamp to valid range
  if (timeout < REQUEST_TIMEOUT_CONFIG.min) {
    systemLogger.warn(`TUNNEL_REQUEST_TIMEOUT ${timeout}ms is below minimum, using ${REQUEST_TIMEOUT_CONFIG.min}ms`);
    return REQUEST_TIMEOUT_CONFIG.min;
  }

  if (timeout > REQUEST_TIMEOUT_CONFIG.max) {
    systemLogger.warn(`TUNNEL_REQUEST_TIMEOUT ${timeout}ms is above maximum, using ${REQUEST_TIMEOUT_CONFIG.max}ms`);
    return REQUEST_TIMEOUT_CONFIG.max;
  }

  return timeout;
}

class TunnelManager extends EventEmitter {
  private connections: Map<string, TunnelConnection> = new Map();
  private subdomainToId: Map<string, string> = new Map();
  private requestTimeout = getRequestTimeout();
  private passwordAttempts: Map<string, PasswordAttempt> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private statsFlushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // In-memory stats counters for batched updates
  private tunnelStats: Map<string, TunnelStats> = new Map();

  constructor() {
    super();
    // Start periodic cleanup of old rate limit entries
    this.cleanupTimer = setInterval(() => {
      this.cleanupRateLimitEntries();
    }, RATE_LIMIT_CONFIG.cleanupInterval);

    // Start periodic stats flush
    this.statsFlushTimer = setInterval(() => {
      this.flushStats();
    }, STATS_FLUSH_CONFIG.flushInterval);

    // Register graceful shutdown handlers
    this.registerShutdownHandlers();
  }

  /**
   * Register handlers for graceful shutdown
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      systemLogger.info(`Received ${signal}. Shutting down gracefully...`);

      try {
        // Flush all pending stats before shutdown
        await this.flushStats();

        // Close all WebSocket connections gracefully
        await this.closeAllConnections();

        // Clear all timers
        this.clearTimers();

        systemLogger.info('Graceful shutdown complete.');
      } catch (error) {
        systemLogger.error('Error during graceful shutdown', error);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('beforeExit', () => shutdown('beforeExit'));
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.statsFlushTimer) {
      clearInterval(this.statsFlushTimer);
      this.statsFlushTimer = null;
    }
  }

  /**
   * Close all WebSocket connections gracefully
   */
  private async closeAllConnections(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [tunnelId, connection] of this.connections) {
      closePromises.push(
        new Promise<void>((resolve) => {
          try {
            // Clear ping interval
            if (connection.pingInterval) {
              clearInterval(connection.pingInterval);
            }

            // Reject all pending requests
            for (const [, pending] of connection.pendingRequests) {
              clearTimeout(pending.timeout);
              pending.reject(new Error('Server shutting down'));
            }

            // Close WebSocket with normal closure code
            if (connection.ws.readyState === 1) { // WebSocket.OPEN
              connection.ws.close(1000, 'Server shutting down');
            }

            resolve();
          } catch (error) {
            systemLogger.error(`Error closing tunnel ${tunnelId}`, error);
            resolve();
          }
        })
      );
    }

    await Promise.all(closePromises);

    // Update all tunnels to inactive in database
    const tunnelIds = Array.from(this.connections.keys());
    if (tunnelIds.length > 0) {
      await prisma.tunnel.updateMany({
        where: { id: { in: tunnelIds } },
        data: { isActive: false },
      }).catch((err) => systemLogger.error('Failed to update tunnels on shutdown', err));
    }

    this.connections.clear();
    this.subdomainToId.clear();
  }

  /**
   * Increment stats for a tunnel (in-memory)
   */
  private incrementStats(tunnelId: string, bytes: number = 0): void {
    const existing = this.tunnelStats.get(tunnelId) || {
      requestCount: 0,
      bytesCount: 0,
      lastActiveAt: new Date(),
    };

    existing.requestCount++;
    existing.bytesCount += bytes;
    existing.lastActiveAt = new Date();

    this.tunnelStats.set(tunnelId, existing);
  }

  /**
   * Flush accumulated stats to database in batch
   */
  private async flushStats(): Promise<void> {
    if (this.tunnelStats.size === 0) return;

    // Take a snapshot of current stats and clear
    const statsToFlush = new Map(this.tunnelStats);
    this.tunnelStats.clear();

    // Process in batches to avoid overwhelming the database
    const entries = Array.from(statsToFlush.entries());

    for (let i = 0; i < entries.length; i += STATS_FLUSH_CONFIG.maxBatchSize) {
      const batch = entries.slice(i, i + STATS_FLUSH_CONFIG.maxBatchSize);

      // Use Promise.allSettled to ensure all updates are attempted
      const updatePromises = batch.map(([tunnelId, stats]) =>
        prisma.tunnel.update({
          where: { id: tunnelId },
          data: {
            totalRequests: { increment: stats.requestCount },
            totalBytes: { increment: stats.bytesCount },
            lastActiveAt: stats.lastActiveAt,
          },
        }).catch((error) => {
          // Re-add stats if update fails (tunnel may have been deleted)
          if (!error.message?.includes('Record to update not found')) {
            const current = this.tunnelStats.get(tunnelId) || {
              requestCount: 0,
              bytesCount: 0,
              lastActiveAt: new Date(),
            };
            current.requestCount += stats.requestCount;
            current.bytesCount += stats.bytesCount;
            this.tunnelStats.set(tunnelId, current);
          }
        })
      );

      await Promise.allSettled(updatePromises);
    }
  }

  private cleanupRateLimitEntries(): void {
    const now = Date.now();
    for (const [key, attempt] of this.passwordAttempts) {
      // Remove entries that haven't had activity in the last hour
      if (now - attempt.lastAttempt > RATE_LIMIT_CONFIG.cleanupInterval) {
        this.passwordAttempts.delete(key);
      }
    }
  }

  private getRateLimitKey(subdomain: string, ip?: string): string {
    return ip ? `${subdomain}:${ip}` : subdomain;
  }

  private checkRateLimit(key: string): { allowed: boolean; waitTime?: number } {
    const attempt = this.passwordAttempts.get(key);
    const now = Date.now();

    if (!attempt) {
      return { allowed: true };
    }

    // Check if still locked out
    if (attempt.lockedUntil > now) {
      return { allowed: false, waitTime: attempt.lockedUntil - now };
    }

    return { allowed: true };
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const attempt = this.passwordAttempts.get(key) || {
      attempts: 0,
      lastAttempt: now,
      lockedUntil: 0,
    };

    attempt.attempts++;
    attempt.lastAttempt = now;

    // Apply exponential backoff after max attempts
    if (attempt.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
      const delay = Math.min(
        RATE_LIMIT_CONFIG.baseDelay * Math.pow(2, attempt.attempts - RATE_LIMIT_CONFIG.maxAttempts),
        RATE_LIMIT_CONFIG.maxDelay
      );
      attempt.lockedUntil = now + delay;
    }

    this.passwordAttempts.set(key, attempt);
  }

  private clearAttempts(key: string): void {
    this.passwordAttempts.delete(key);
  }

  async createTunnel(
    ws: WebSocket,
    options: CreateTunnelOptions,
  ): Promise<{ tunnelId: string; subdomain: string; publicUrl: string }> {
    if (this.isShuttingDown) {
      throw new Error('Server is shutting down');
    }

    const MAX_RETRIES = 5;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < MAX_RETRIES) {
      attempts++;

      try {
        const result = await this.tryCreateTunnel(ws, options, attempts > 1);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If user requested specific subdomain and it's taken, don't retry
        if (options.subdomain && lastError.message.includes('already in use')) {
          throw lastError;
        }

        // If it's a unique constraint violation, retry with new subdomain
        if (lastError.message.includes('Unique constraint') ||
            lastError.message.includes('already in use')) {
          continue;
        }

        // For other errors, throw immediately
        throw lastError;
      }
    }

    throw lastError || new Error('Failed to create tunnel after maximum retries');
  }

  private async tryCreateTunnel(
    ws: WebSocket,
    options: CreateTunnelOptions,
    forceNewSubdomain: boolean = false,
  ): Promise<{ tunnelId: string; subdomain: string; publicUrl: string }> {
    let subdomain: string;

    if (options.subdomain && !forceNewSubdomain) {
      subdomain = normalizeSubdomain(options.subdomain);

      // Validate subdomain
      const validation = validateSubdomain(subdomain);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check if subdomain is already in use (in-memory)
      if (this.subdomainToId.has(subdomain)) {
        throw new Error('Subdomain is already in use');
      }
    } else {
      // Generate unique subdomain with collision avoidance
      subdomain = generateSubdomain();
      let subdomainAttempts = 0;
      const maxSubdomainAttempts = 10;

      while (this.subdomainToId.has(subdomain) && subdomainAttempts < maxSubdomainAttempts) {
        subdomain = generateSubdomain();
        subdomainAttempts++;
      }

      if (this.subdomainToId.has(subdomain)) {
        throw new Error('Failed to generate unique subdomain');
      }
    }

    // Hash password if provided
    const hashedPassword = options.password
      ? await hashPassword(options.password)
      : null;

    // Use transaction to ensure atomicity
    const tunnel = await prisma.$transaction(async (tx) => {
      // Check if active tunnel exists with this subdomain
      const existing = await tx.tunnel.findUnique({
        where: { subdomain },
      });

      if (existing && existing.isActive) {
        if (options.subdomain) {
          throw new Error('Subdomain is already in use');
        }
        throw new Error('Subdomain collision - retry required');
      }

      // Create or update tunnel
      return tx.tunnel.upsert({
        where: { subdomain },
        update: {
          localPort: options.localPort,
          localHost: options.localHost || 'localhost',
          password: hashedPassword,
          ipWhitelist: options.ipWhitelist || null,
          expiresAt: options.expiresAt || null,
          inspect: options.inspect ?? true,
          isActive: true,
          lastActiveAt: new Date(),
        },
        create: {
          subdomain,
          localPort: options.localPort,
          localHost: options.localHost || 'localhost',
          password: hashedPassword,
          ipWhitelist: options.ipWhitelist || null,
          expiresAt: options.expiresAt || null,
          inspect: options.inspect ?? true,
          isActive: true,
        },
      });
    });

    // Periodic ping to check connection health (every 30 seconds)
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    // Store connection with cached data to avoid DB queries on each request
    const connection: TunnelConnection = {
      id: tunnel.id,
      subdomain,
      ws,
      localPort: options.localPort,
      localHost: options.localHost || 'localhost',
      createdAt: new Date(),
      pendingRequests: new Map(),
      expiresAt: options.expiresAt || null,
      ipWhitelist: parseIpWhitelist(options.ipWhitelist || null),
      pingInterval,
    };

    this.connections.set(tunnel.id, connection);
    this.subdomainToId.set(subdomain, tunnel.id);

    // Handle WebSocket close
    ws.on('close', () => {
      clearInterval(pingInterval);
      this.removeTunnel(tunnel.id);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      systemLogger.error('WebSocket error for tunnel', error, { tunnelId: tunnel.id });
      clearInterval(pingInterval);
      this.removeTunnel(tunnel.id);
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(tunnel.id, message);
      } catch (error) {
        systemLogger.error('Failed to parse WebSocket message', error);
      }
    });

    // Handle ping from client
    ws.on('ping', () => {
      ws.pong();
    });

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const publicUrl = `http://${subdomain}.${domain}`;

    this.emit('tunnel:created', { tunnelId: tunnel.id, subdomain, publicUrl });

    return {
      tunnelId: tunnel.id,
      subdomain,
      publicUrl,
    };
  }

  async removeTunnel(tunnelId: string): Promise<void> {
    const connection = this.connections.get(tunnelId);
    if (!connection) return;

    // Clear ping interval
    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
    }

    // Reject all pending requests
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Tunnel closed'));
    }

    this.connections.delete(tunnelId);
    this.subdomainToId.delete(connection.subdomain);

    // Flush any pending stats for this tunnel before removing
    const stats = this.tunnelStats.get(tunnelId);
    if (stats) {
      this.tunnelStats.delete(tunnelId);
      await prisma.tunnel.update({
        where: { id: tunnelId },
        data: {
          isActive: false,
          totalRequests: { increment: stats.requestCount },
          totalBytes: { increment: stats.bytesCount },
          lastActiveAt: stats.lastActiveAt,
        },
      }).catch((err) => systemLogger.error('Failed to update tunnel stats on remove', err, { tunnelId }));
    } else {
      // Update database
      await prisma.tunnel.update({
        where: { id: tunnelId },
        data: { isActive: false },
      }).catch((err) => systemLogger.error('Failed to update tunnel status on remove', err, { tunnelId }));
    }

    this.emit('tunnel:closed', { tunnelId, subdomain: connection.subdomain });
  }

  async forwardRequest(
    subdomain: string,
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: string;
      ip?: string;
    },
  ): Promise<ResponseMessage['payload']> {
    if (this.isShuttingDown) {
      throw new Error('Server is shutting down');
    }

    const tunnelId = this.subdomainToId.get(subdomain);
    if (!tunnelId) {
      throw new Error('Tunnel not found');
    }

    const connection = this.connections.get(tunnelId);
    if (!connection) {
      throw new Error('Tunnel not found');
    }

    // Use cached expiration and IP whitelist to avoid database query on every request
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      throw new Error('Tunnel has expired');
    }

    // Check IP whitelist using cached data
    if (request.ip && connection.ipWhitelist.length > 0) {
      if (!isIpAllowed(request.ip, connection.ipWhitelist)) {
        throw new Error('IP not allowed');
      }
    }

    // Validate request body size to prevent memory exhaustion
    if (request.body && request.body.length > MAX_BODY_SIZE) {
      throw new Error(`Request body too large (max ${MAX_BODY_SIZE / 1024 / 1024}MB)`);
    }

    const requestId = generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      connection.pendingRequests.set(requestId, { resolve, reject, timeout });

      const message: RequestMessage = {
        type: MessageType.REQUEST,
        requestId,
        payload: {
          method: request.method,
          path: request.path,
          headers: request.headers,
          body: request.body,
        },
      };

      connection.ws.send(JSON.stringify(message));

      // Increment in-memory stats (batched database updates)
      const bodySize = request.body ? request.body.length : 0;
      this.incrementStats(tunnelId, bodySize);
    });
  }

  async verifyTunnelPassword(
    subdomain: string,
    password: string,
    clientIp?: string
  ): Promise<{ success: boolean; rateLimited?: boolean; waitTime?: number }> {
    const rateLimitKey = this.getRateLimitKey(subdomain, clientIp);

    // Check rate limit
    const rateCheck = this.checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return {
        success: false,
        rateLimited: true,
        waitTime: rateCheck.waitTime,
      };
    }

    const tunnel = await prisma.tunnel.findUnique({
      where: { subdomain },
    });

    if (!tunnel || !tunnel.password) {
      return { success: true }; // No password required
    }

    const isValid = await verifyPassword(password, tunnel.password);

    if (isValid) {
      // Clear failed attempts on successful verification
      this.clearAttempts(rateLimitKey);
      return { success: true };
    } else {
      // Record failed attempt
      this.recordFailedAttempt(rateLimitKey);
      return { success: false };
    }
  }

  isTunnelPasswordProtected(subdomain: string): Promise<boolean> {
    return prisma.tunnel.findUnique({
      where: { subdomain },
      select: { password: true },
    }).then((tunnel) => !!tunnel?.password);
  }

  private handleMessage(tunnelId: string, message: WSMessage): void {
    const connection = this.connections.get(tunnelId);
    if (!connection) return;

    switch (message.type) {
      case MessageType.RESPONSE: {
        const responseMessage = message as ResponseMessage;
        const pending = connection.pendingRequests.get(responseMessage.requestId!);
        if (pending) {
          clearTimeout(pending.timeout);
          connection.pendingRequests.delete(responseMessage.requestId!);
          pending.resolve(responseMessage.payload);
        }
        break;
      }
      case MessageType.PING: {
        connection.ws.send(JSON.stringify({ type: MessageType.PONG }));
        break;
      }
    }
  }

  getTunnelBySubdomain(subdomain: string): TunnelConnection | undefined {
    const tunnelId = this.subdomainToId.get(subdomain);
    return tunnelId ? this.connections.get(tunnelId) : undefined;
  }

  getActiveTunnels(): TunnelConnection[] {
    return Array.from(this.connections.values());
  }

  getTunnelCount(): number {
    return this.connections.size;
  }

  /**
   * Get pending stats count (for monitoring)
   */
  getPendingStatsCount(): number {
    return this.tunnelStats.size;
  }

  /**
   * Check if manager is shutting down
   */
  isServerShuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

// Singleton instance
export const tunnelManager = new TunnelManager();
