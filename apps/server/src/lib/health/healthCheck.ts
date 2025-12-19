import { prisma } from '@/lib/db/prisma';
import os from 'os';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// SSRF Protection: Block private and reserved IP ranges
const BLOCKED_IP_RANGES = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B
  /^192\.168\./,                     // Private Class C
  /^169\.254\./,                     // Link-local (AWS metadata)
  /^0\./,                            // Current network
  /^224\./,                          // Multicast
  /^240\./,                          // Reserved
  /^255\./,                          // Broadcast
  /^::1$/,                           // IPv6 loopback
  /^fe80:/i,                         // IPv6 link-local
  /^fc00:/i,                         // IPv6 unique local
  /^fd/i,                            // IPv6 unique local
];

// Check if an IP address is in a blocked range
function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(pattern => pattern.test(ip));
}

// Validate URL and resolve hostname to check for SSRF
async function validateUrlForSsrf(urlString: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // Block common cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      'metadata.goog',
      'kubernetes.default.svc',
    ];
    if (blockedHosts.some(h => hostname.includes(h))) {
      return { valid: false, error: 'Blocked hostname' };
    }

    // Check if hostname is an IP address
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch && isBlockedIp(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    // Resolve hostname and check resolved IP
    try {
      const { address } = await dnsLookup(hostname);
      if (isBlockedIp(address)) {
        return { valid: false, error: 'Hostname resolves to a private IP address' };
      }
    } catch {
      // DNS resolution failed - allow the request to fail naturally
      // This prevents information leakage about internal DNS
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }
}

// Types
export type HealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN' | 'CRITICAL';
export type CheckType = 'TUNNEL' | 'HTTP' | 'TCP' | 'DATABASE';
export type ResultStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT';

export interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  version: string;
  timestamp: Date;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: HealthStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckConfig {
  name: string;
  type: CheckType;
  target: string;
  enabled?: boolean;
  interval?: number;
  timeout?: number;
  retries?: number;
  alertOnFailure?: boolean;
  alertAfterRetries?: number;
  tunnelId?: string;
}

export interface CheckResult {
  status: ResultStatus;
  responseTime?: number;
  statusCode?: number;
  message?: string;
}

export interface UptimeStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number;
  averageResponseTime: number;
}

// System Health Check
export async function getSystemHealth(): Promise<SystemHealth> {
  const startTime = Date.now();

  // Check database
  const database = await checkDatabase();

  // Check memory
  const memory = checkMemory();

  // Determine overall status
  let status: HealthStatus = 'HEALTHY';
  if (database.status === 'UNHEALTHY') {
    status = 'UNHEALTHY';
  } else if (database.status === 'DEGRADED' || memory.status === 'DEGRADED') {
    status = 'DEGRADED';
  }

  return {
    status,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date(),
    components: {
      database,
      memory,
      disk: checkDisk(),
    },
  };
}

// Database health check
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    if (responseTime > 1000) {
      return {
        status: 'DEGRADED',
        message: 'Database responding slowly',
        details: { responseTime },
      };
    }

    return {
      status: 'HEALTHY',
      message: 'Database connected',
      details: { responseTime },
    };
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      message: 'Database connection failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

// Memory health check
function checkMemory(): ComponentHealth {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  if (usagePercent > 90) {
    return {
      status: 'UNHEALTHY',
      message: 'Memory usage critical',
      details: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: Math.round(usagePercent),
      },
    };
  }

  if (usagePercent > 75) {
    return {
      status: 'DEGRADED',
      message: 'Memory usage high',
      details: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: Math.round(usagePercent),
      },
    };
  }

  return {
    status: 'HEALTHY',
    message: 'Memory usage normal',
    details: {
      total: formatBytes(totalMemory),
      used: formatBytes(usedMemory),
      free: formatBytes(freeMemory),
      usagePercent: Math.round(usagePercent),
    },
  };
}

// Disk health check with cross-platform support
function checkDisk(): ComponentHealth {
  try {
    const diskInfo = getDiskUsage();

    if (!diskInfo) {
      return {
        status: 'HEALTHY',
        message: 'Disk space available (monitoring limited on this platform)',
        details: {
          note: 'Detailed disk monitoring requires additional platform support',
        },
      };
    }

    const usagePercent = (diskInfo.used / diskInfo.total) * 100;
    const freePercent = 100 - usagePercent;

    let status: HealthStatus = 'HEALTHY';
    let message = 'Disk space available';

    if (freePercent < 5) {
      status = 'CRITICAL';
      message = `Critical: Only ${freePercent.toFixed(1)}% disk space remaining`;
    } else if (freePercent < 10) {
      status = 'UNHEALTHY';
      message = `Warning: Only ${freePercent.toFixed(1)}% disk space remaining`;
    } else if (freePercent < 20) {
      status = 'DEGRADED';
      message = `Low disk space: ${freePercent.toFixed(1)}% remaining`;
    }

    return {
      status,
      message,
      details: {
        total: formatBytes(diskInfo.total),
        used: formatBytes(diskInfo.used),
        free: formatBytes(diskInfo.free),
        usagePercent: Math.round(usagePercent),
        freePercent: Math.round(freePercent),
      },
    };
  } catch (error) {
    return {
      status: 'HEALTHY',
      message: 'Disk monitoring unavailable',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// Get disk usage for the current working directory
function getDiskUsage(): { total: number; used: number; free: number } | null {
  try {
    const { execSync } = require('child_process');
    const cwd = process.cwd();
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use WMIC command
      const drive = cwd.split(':')[0] + ':';
      const output = execSync(
        `wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace /format:csv`,
        { encoding: 'utf8', timeout: 5000 }
      );

      // Parse CSV output: Node,FreeSpace,Size
      const lines = output.trim().split('\n').filter((line: string) => line.trim());
      if (lines.length >= 2) {
        const values = lines[1].split(',');
        if (values.length >= 3) {
          const freeSpace = parseInt(values[1], 10);
          const totalSize = parseInt(values[2], 10);
          if (!isNaN(freeSpace) && !isNaN(totalSize) && totalSize > 0) {
            return {
              total: totalSize,
              free: freeSpace,
              used: totalSize - freeSpace,
            };
          }
        }
      }
    } else {
      // Unix-like (Linux, macOS): Use df command
      const output = execSync(`df -k "${cwd}"`, { encoding: 'utf8', timeout: 5000 });

      // Parse df output
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        // Second line contains the data
        const parts = lines[1].split(/\s+/);
        // Format: Filesystem 1K-blocks Used Available Use% Mounted
        if (parts.length >= 4) {
          const total = parseInt(parts[1], 10) * 1024; // Convert from KB to bytes
          const used = parseInt(parts[2], 10) * 1024;
          const free = parseInt(parts[3], 10) * 1024;

          if (!isNaN(total) && !isNaN(used) && !isNaN(free) && total > 0) {
            return { total, used, free };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// Health Check Configuration Limits
const HEALTH_CHECK_LIMITS = {
  minInterval: 10,       // 10 seconds minimum
  maxInterval: 86400,    // 24 hours maximum
  minTimeout: 1,         // 1 second minimum
  maxTimeout: 300,       // 5 minutes maximum
  minRetries: 0,
  maxRetries: 10,
} as const;

// Validate URL format
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Health Check CRUD Operations
export async function createHealthCheck(
  userId: string,
  config: HealthCheckConfig
) {
  // Validate name
  if (!config.name || config.name.trim().length === 0) {
    throw new Error('Health check name is required');
  }
  if (config.name.length > 100) {
    throw new Error('Health check name must be 100 characters or less');
  }

  // Validate target for HTTP type
  if (config.type === 'HTTP' || config.type === 'TCP') {
    if (!config.target) {
      throw new Error('Target URL is required for HTTP/TCP health checks');
    }
    // For HTTP type, validate URL format
    if (config.type === 'HTTP' && !isValidUrl(config.target)) {
      throw new Error('Invalid target URL format (must be http:// or https://)');
    }
  }

  // Validate interval range
  const interval = config.interval ?? 60;
  if (interval < HEALTH_CHECK_LIMITS.minInterval || interval > HEALTH_CHECK_LIMITS.maxInterval) {
    throw new Error(`Interval must be between ${HEALTH_CHECK_LIMITS.minInterval}s and ${HEALTH_CHECK_LIMITS.maxInterval}s`);
  }

  // Validate timeout range
  const timeout = config.timeout ?? 30;
  if (timeout < HEALTH_CHECK_LIMITS.minTimeout || timeout > HEALTH_CHECK_LIMITS.maxTimeout) {
    throw new Error(`Timeout must be between ${HEALTH_CHECK_LIMITS.minTimeout}s and ${HEALTH_CHECK_LIMITS.maxTimeout}s`);
  }

  // Ensure timeout is less than interval
  if (timeout >= interval) {
    throw new Error('Timeout must be less than interval');
  }

  // Validate retries
  const retries = config.retries ?? 3;
  if (retries < HEALTH_CHECK_LIMITS.minRetries || retries > HEALTH_CHECK_LIMITS.maxRetries) {
    throw new Error(`Retries must be between ${HEALTH_CHECK_LIMITS.minRetries} and ${HEALTH_CHECK_LIMITS.maxRetries}`);
  }

  return prisma.healthCheck.create({
    data: {
      name: config.name.trim(),
      type: config.type,
      target: config.target,
      enabled: config.enabled ?? true,
      interval,
      timeout,
      retries,
      alertOnFailure: config.alertOnFailure ?? true,
      alertAfterRetries: config.alertAfterRetries ?? 2,
      tunnelId: config.tunnelId,
      userId,
    },
  });
}

export async function getHealthChecks(
  userId: string,
  options?: { tunnelId?: string; status?: HealthStatus; limit?: number; offset?: number }
) {
  const where: Record<string, unknown> = { userId };

  if (options?.tunnelId) {
    where.tunnelId = options.tunnelId;
  }

  if (options?.status) {
    where.status = options.status;
  }

  const [checks, total] = await Promise.all([
    prisma.healthCheck.findMany({
      where,
      include: {
        tunnel: { select: { subdomain: true } },
        results: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.healthCheck.count({ where }),
  ]);

  return { checks, total };
}

export async function getHealthCheck(userId: string, checkId: string) {
  return prisma.healthCheck.findFirst({
    where: { id: checkId, userId },
    include: {
      tunnel: { select: { subdomain: true, isActive: true } },
      results: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function updateHealthCheck(
  userId: string,
  checkId: string,
  data: Partial<HealthCheckConfig>
) {
  return prisma.healthCheck.updateMany({
    where: { id: checkId, userId },
    data: {
      name: data.name,
      target: data.target,
      enabled: data.enabled,
      interval: data.interval,
      timeout: data.timeout,
      retries: data.retries,
      alertOnFailure: data.alertOnFailure,
      alertAfterRetries: data.alertAfterRetries,
    },
  });
}

export async function deleteHealthCheck(userId: string, checkId: string) {
  return prisma.healthCheck.deleteMany({
    where: { id: checkId, userId },
  });
}

// Run Health Check
export async function runHealthCheck(checkId: string): Promise<CheckResult> {
  const check = await prisma.healthCheck.findUnique({
    where: { id: checkId },
    include: { tunnel: true },
  });

  if (!check) {
    return { status: 'FAILURE', message: 'Health check not found' };
  }

  let result: CheckResult;

  switch (check.type) {
    case 'HTTP':
      result = await runHttpCheck(check.target, check.timeout * 1000);
      break;
    case 'TCP':
      result = await runTcpCheck(check.target, check.timeout * 1000);
      break;
    case 'TUNNEL':
      result = await runTunnelCheck(check.tunnel, check.timeout * 1000);
      break;
    case 'DATABASE':
      result = await runDatabaseCheck();
      break;
    default:
      result = { status: 'FAILURE', message: `Unknown check type: ${check.type}` };
  }

  // Save result
  await prisma.healthCheckResult.create({
    data: {
      healthCheckId: checkId,
      status: result.status,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      message: result.message,
    },
  });

  // Update check status
  const isSuccess = result.status === 'SUCCESS';
  // Cap consecutive fails to prevent integer overflow and excessive values
  const MAX_CONSECUTIVE_FAILS = 1000;
  const newConsecutiveFails = isSuccess
    ? 0
    : Math.min(check.consecutiveFails + 1, MAX_CONSECUTIVE_FAILS);
  const newStatus: HealthStatus = isSuccess
    ? 'HEALTHY'
    : newConsecutiveFails >= check.alertAfterRetries
      ? 'UNHEALTHY'
      : 'DEGRADED';

  await prisma.healthCheck.update({
    where: { id: checkId },
    data: {
      status: newStatus,
      lastCheck: new Date(),
      lastSuccess: isSuccess ? new Date() : undefined,
      lastFailure: !isSuccess ? new Date() : undefined,
      consecutiveFails: newConsecutiveFails,
    },
  });

  return result;
}

// HTTP Health Check
async function runHttpCheck(url: string, timeout: number): Promise<CheckResult> {
  const startTime = Date.now();

  // SSRF Protection: Validate URL before making request
  const validation = await validateUrlForSsrf(url);
  if (!validation.valid) {
    return {
      status: 'FAILURE',
      responseTime: Date.now() - startTime,
      message: `SSRF protection: ${validation.error}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'SUCCESS',
        responseTime,
        statusCode: response.status,
        message: 'HTTP check passed',
      };
    }

    return {
      status: 'FAILURE',
      responseTime,
      statusCode: response.status,
      message: `HTTP error: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'TIMEOUT',
        responseTime,
        message: 'Request timed out',
      };
    }

    return {
      status: 'FAILURE',
      responseTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// TCP Health Check (simplified)
async function runTcpCheck(target: string, timeout: number): Promise<CheckResult> {
  // TCP check would require net module
  // For now, we'll do an HTTP check to the target
  const startTime = Date.now();
  const url = target.startsWith('http') ? target : `http://${target}`;

  // SSRF Protection: Validate URL before making request
  const validation = await validateUrlForSsrf(url);
  if (!validation.valid) {
    return {
      status: 'FAILURE',
      responseTime: Date.now() - startTime,
      message: `SSRF protection: ${validation.error}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return {
      status: 'SUCCESS',
      responseTime: Date.now() - startTime,
      message: 'TCP connection successful',
    };
  } catch (error) {
    return {
      status: 'FAILURE',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Tunnel Health Check
async function runTunnelCheck(
  tunnel: { subdomain: string; localPort: number; localHost: string; isActive: boolean } | null,
  timeout: number
): Promise<CheckResult> {
  if (!tunnel) {
    return { status: 'FAILURE', message: 'Tunnel not found' };
  }

  if (!tunnel.isActive) {
    return { status: 'FAILURE', message: 'Tunnel is not active' };
  }

  const startTime = Date.now();
  const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
  const url = `http://${tunnel.subdomain}.${domain}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      status: response.ok ? 'SUCCESS' : 'FAILURE',
      responseTime,
      statusCode: response.status,
      message: response.ok ? 'Tunnel is healthy' : `Tunnel returned ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'FAILURE',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Tunnel check failed',
    };
  }
}

// Database Health Check
async function runDatabaseCheck(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'SUCCESS',
      responseTime: Date.now() - startTime,
      message: 'Database is healthy',
    };
  } catch (error) {
    return {
      status: 'FAILURE',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Database check failed',
    };
  }
}

// Get Check History
export async function getCheckHistory(
  checkId: string,
  options?: { limit?: number; offset?: number }
) {
  const [results, total] = await Promise.all([
    prisma.healthCheckResult.findMany({
      where: { healthCheckId: checkId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    }),
    prisma.healthCheckResult.count({ where: { healthCheckId: checkId } }),
  ]);

  return { results, total };
}

// Get Uptime Stats - Uses database aggregation to avoid N+1 query problem
export async function getUptimeStats(
  checkId: string,
  period: 'day' | 'week' | 'month' = 'day'
): Promise<UptimeStats> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  // Use database aggregation to avoid fetching all records
  const [stats, successCount] = await Promise.all([
    prisma.healthCheckResult.aggregate({
      where: {
        healthCheckId: checkId,
        createdAt: { gte: startDate },
      },
      _count: { _all: true },
      _avg: { responseTime: true },
    }),
    prisma.healthCheckResult.count({
      where: {
        healthCheckId: checkId,
        createdAt: { gte: startDate },
        status: 'SUCCESS',
      },
    }),
  ]);

  const totalChecks = stats._count._all;
  const successfulChecks = successCount;
  const failedChecks = totalChecks - successfulChecks;
  const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
  const averageResponseTime = stats._avg.responseTime ?? 0;

  return {
    totalChecks,
    successfulChecks,
    failedChecks,
    uptimePercentage: Math.round(uptimePercentage * 100) / 100,
    averageResponseTime: Math.round(averageResponseTime),
  };
}

// Get Tunnel Health
export async function getTunnelHealth(tunnelId: string) {
  const tunnel = await prisma.tunnel.findUnique({
    where: { id: tunnelId },
    include: {
      healthChecks: {
        include: {
          results: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });

  if (!tunnel) {
    return null;
  }

  const healthChecks = tunnel.healthChecks;
  const unhealthyChecks = healthChecks.filter((c) => c.status === 'UNHEALTHY');
  const degradedChecks = healthChecks.filter((c) => c.status === 'DEGRADED');

  let status: HealthStatus = 'HEALTHY';
  if (unhealthyChecks.length > 0) {
    status = 'UNHEALTHY';
  } else if (degradedChecks.length > 0) {
    status = 'DEGRADED';
  } else if (healthChecks.length === 0) {
    status = 'UNKNOWN';
  }

  return {
    tunnelId,
    subdomain: tunnel.subdomain,
    isActive: tunnel.isActive,
    status,
    checksCount: healthChecks.length,
    healthyCount: healthChecks.filter((c) => c.status === 'HEALTHY').length,
    unhealthyCount: unhealthyChecks.length,
    degradedCount: degradedChecks.length,
    lastCheck: healthChecks[0]?.lastCheck || null,
    checks: healthChecks.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      lastCheck: c.lastCheck,
      lastResult: c.results[0] || null,
    })),
  };
}
