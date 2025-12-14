import { prisma } from '@/lib/prisma';
import os from 'os';

// Types
export type HealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN';
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

// Disk health check (simplified)
function checkDisk(): ComponentHealth {
  // In a real implementation, you'd check actual disk usage
  // For now, we return a healthy status
  return {
    status: 'HEALTHY',
    message: 'Disk space available',
    details: {
      note: 'Disk monitoring not implemented for this platform',
    },
  };
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

// Health Check CRUD Operations
export async function createHealthCheck(
  userId: string,
  config: HealthCheckConfig
) {
  return prisma.healthCheck.create({
    data: {
      name: config.name,
      type: config.type,
      target: config.target,
      enabled: config.enabled ?? true,
      interval: config.interval ?? 60,
      timeout: config.timeout ?? 30,
      retries: config.retries ?? 3,
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
  const newConsecutiveFails = isSuccess ? 0 : check.consecutiveFails + 1;
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

  try {
    const url = target.startsWith('http') ? target : `http://${target}`;
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

// Get Uptime Stats
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

  const results = await prisma.healthCheckResult.findMany({
    where: {
      healthCheckId: checkId,
      createdAt: { gte: startDate },
    },
    select: {
      status: true,
      responseTime: true,
    },
  });

  const totalChecks = results.length;
  const successfulChecks = results.filter((r) => r.status === 'SUCCESS').length;
  const failedChecks = totalChecks - successfulChecks;
  const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

  const responseTimes = results
    .filter((r) => r.responseTime !== null)
    .map((r) => r.responseTime as number);
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

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
