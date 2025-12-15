/**
 * Data Retention Policy Service
 * Handles cleanup of old data based on configurable retention periods
 */

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/api/logger';

// Retention periods (in days)
export interface RetentionConfig {
  // Request logs retention (default: 30 days)
  requestLogs: number;
  // Health check results retention (default: 90 days)
  healthCheckResults: number;
  // Audit logs retention (default: 365 days)
  auditLogs: number;
  // Inactive tunnels cleanup (default: 90 days)
  inactiveTunnels: number;
  // Rate limit hits cleanup (default: 7 days)
  rateLimitHits: number;
  // Expired sessions cleanup (default: 0 - immediate)
  expiredSessions: number;
  // Expired invitations cleanup (default: 0 - immediate)
  expiredInvitations: number;
}

// Default retention configuration
const DEFAULT_RETENTION: RetentionConfig = {
  requestLogs: 30,
  healthCheckResults: 90,
  auditLogs: 365,
  inactiveTunnels: 90,
  rateLimitHits: 7,
  expiredSessions: 0,
  expiredInvitations: 0,
};

// Parse environment variables once at module load time for efficiency
// This avoids repeated parsing on every call to getRetentionConfig
const PARSED_RETENTION_CONFIG: RetentionConfig = {
  requestLogs: parseInt(process.env.RETENTION_REQUEST_LOGS || '') || DEFAULT_RETENTION.requestLogs,
  healthCheckResults: parseInt(process.env.RETENTION_HEALTH_RESULTS || '') || DEFAULT_RETENTION.healthCheckResults,
  auditLogs: parseInt(process.env.RETENTION_AUDIT_LOGS || '') || DEFAULT_RETENTION.auditLogs,
  inactiveTunnels: parseInt(process.env.RETENTION_INACTIVE_TUNNELS || '') || DEFAULT_RETENTION.inactiveTunnels,
  rateLimitHits: parseInt(process.env.RETENTION_RATE_LIMITS || '') || DEFAULT_RETENTION.rateLimitHits,
  expiredSessions: parseInt(process.env.RETENTION_SESSIONS || '') || DEFAULT_RETENTION.expiredSessions,
  expiredInvitations: parseInt(process.env.RETENTION_INVITATIONS || '') || DEFAULT_RETENTION.expiredInvitations,
};

/**
 * Get retention config from environment or defaults
 * Values are parsed once at module load time for efficiency
 */
export function getRetentionConfig(): RetentionConfig {
  return { ...PARSED_RETENTION_CONFIG };
}

/**
 * Calculate date threshold for retention
 * Uses millisecond-based calculation to avoid issues with month boundaries
 */
function getDateThreshold(days: number): Date {
  const now = new Date();
  // Use milliseconds to calculate exact time difference
  // This avoids issues with setDate() across month boundaries
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - (days * msPerDay));
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  table: string;
  deleted: number;
  error?: string;
}

/**
 * Clean up old request logs
 */
export async function cleanupRequestLogs(days: number): Promise<CleanupResult> {
  try {
    const threshold = getDateThreshold(days);
    const result = await prisma.request.deleteMany({
      where: {
        createdAt: { lt: threshold },
      },
    });
    return { table: 'Request', deleted: result.count };
  } catch (error) {
    return { table: 'Request', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up old health check results
 */
export async function cleanupHealthCheckResults(days: number): Promise<CleanupResult> {
  try {
    const threshold = getDateThreshold(days);
    const result = await prisma.healthCheckResult.deleteMany({
      where: {
        createdAt: { lt: threshold },
      },
    });
    return { table: 'HealthCheckResult', deleted: result.count };
  } catch (error) {
    return { table: 'HealthCheckResult', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up old audit logs
 */
export async function cleanupAuditLogs(days: number): Promise<CleanupResult> {
  try {
    const threshold = getDateThreshold(days);
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: threshold },
      },
    });
    return { table: 'AuditLog', deleted: result.count };
  } catch (error) {
    return { table: 'AuditLog', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up inactive tunnels
 */
export async function cleanupInactiveTunnels(days: number): Promise<CleanupResult> {
  try {
    const threshold = getDateThreshold(days);
    const result = await prisma.tunnel.deleteMany({
      where: {
        isActive: false,
        lastActiveAt: { lt: threshold },
      },
    });
    return { table: 'Tunnel (inactive)', deleted: result.count };
  } catch (error) {
    return { table: 'Tunnel (inactive)', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up old rate limit hits
 */
export async function cleanupRateLimitHits(days: number): Promise<CleanupResult> {
  try {
    const threshold = getDateThreshold(days);
    const result = await prisma.rateLimitHit.deleteMany({
      where: {
        windowStart: { lt: threshold },
      },
    });
    return { table: 'RateLimitHit', deleted: result.count };
  } catch (error) {
    return { table: 'RateLimitHit', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<CleanupResult> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    return { table: 'Session', deleted: result.count };
  } catch (error) {
    return { table: 'Session', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up expired team invitations
 */
export async function cleanupExpiredInvitations(): Promise<CleanupResult> {
  try {
    const result = await prisma.teamInvitation.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return { table: 'TeamInvitation', deleted: result.count };
  } catch (error) {
    return { table: 'TeamInvitation', deleted: 0, error: String(error) };
  }
}

/**
 * Clean up expired encryption keys
 */
export async function cleanupExpiredEncryptionKeys(): Promise<CleanupResult> {
  try {
    // Only delete keys that have been expired for more than 30 days
    // to give time for key rotation
    const threshold = getDateThreshold(30);
    const result = await prisma.encryptionKey.deleteMany({
      where: {
        expiresAt: { lt: threshold },
      },
    });
    return { table: 'EncryptionKey', deleted: result.count };
  } catch (error) {
    return { table: 'EncryptionKey', deleted: 0, error: String(error) };
  }
}

/**
 * Run all cleanup tasks
 */
export async function runAllCleanup(config?: Partial<RetentionConfig>): Promise<CleanupResult[]> {
  const retentionConfig = { ...getRetentionConfig(), ...config };
  const results: CleanupResult[] = [];

  log('info', 'Starting data retention cleanup', { config: retentionConfig });

  // Run all cleanup tasks
  results.push(await cleanupRequestLogs(retentionConfig.requestLogs));
  results.push(await cleanupHealthCheckResults(retentionConfig.healthCheckResults));
  results.push(await cleanupAuditLogs(retentionConfig.auditLogs));
  results.push(await cleanupInactiveTunnels(retentionConfig.inactiveTunnels));
  results.push(await cleanupRateLimitHits(retentionConfig.rateLimitHits));
  results.push(await cleanupExpiredSessions());
  results.push(await cleanupExpiredInvitations());
  results.push(await cleanupExpiredEncryptionKeys());

  // Log summary
  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const errors = results.filter((r) => r.error);

  log('info', 'Data retention cleanup completed', {
    totalDeleted,
    errors: errors.length,
    details: results,
  });

  return results;
}

/**
 * Get data retention statistics
 */
export async function getRetentionStats(): Promise<{
  config: RetentionConfig;
  counts: {
    requests: number;
    healthCheckResults: number;
    auditLogs: number;
    inactiveTunnels: number;
    rateLimitHits: number;
    expiredSessions: number;
    expiredInvitations: number;
  };
}> {
  const config = getRetentionConfig();

  const [
    requests,
    healthCheckResults,
    auditLogs,
    inactiveTunnels,
    rateLimitHits,
    expiredSessions,
    expiredInvitations,
  ] = await Promise.all([
    prisma.request.count({
      where: { createdAt: { lt: getDateThreshold(config.requestLogs) } },
    }),
    prisma.healthCheckResult.count({
      where: { createdAt: { lt: getDateThreshold(config.healthCheckResults) } },
    }),
    prisma.auditLog.count({
      where: { createdAt: { lt: getDateThreshold(config.auditLogs) } },
    }),
    prisma.tunnel.count({
      where: {
        isActive: false,
        lastActiveAt: { lt: getDateThreshold(config.inactiveTunnels) },
      },
    }),
    prisma.rateLimitHit.count({
      where: { windowStart: { lt: getDateThreshold(config.rateLimitHits) } },
    }),
    prisma.session.count({
      where: { expires: { lt: new Date() } },
    }),
    prisma.teamInvitation.count({
      where: { expiresAt: { lt: new Date() } },
    }),
  ]);

  return {
    config,
    counts: {
      requests,
      healthCheckResults,
      auditLogs,
      inactiveTunnels,
      rateLimitHits,
      expiredSessions,
      expiredInvitations,
    },
  };
}
