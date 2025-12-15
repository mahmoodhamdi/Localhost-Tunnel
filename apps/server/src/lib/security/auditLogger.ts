import { prisma } from '@/lib/db/prisma';

// Safe JSON parse with fallback for corrupted data
function parseJsonSafe<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error('Failed to parse JSON in audit log, using fallback');
    return fallback;
  }
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'INVITE'
  | 'JOIN'
  | 'LEAVE'
  | 'REVOKE'
  | 'TRANSFER';

export type AuditResource =
  | 'USER'
  | 'TUNNEL'
  | 'TEAM'
  | 'TEAM_MEMBER'
  | 'API_KEY'
  | 'RATE_LIMIT_RULE'
  | 'GEO_RULE'
  | 'SETTINGS';

export type AuditStatus = 'SUCCESS' | 'FAILURE';

interface AuditEvent {
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  status?: AuditStatus;
}

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
}

function getClientIP(request?: Request): string | undefined {
  if (!request) return undefined;

  // Try various headers for IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return undefined;
}

function getRequestContext(request?: Request): RequestContext {
  if (!request) return {};

  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

export async function logAuditEvent(
  userId: string,
  event: AuditEvent,
  request?: Request
): Promise<void> {
  try {
    const context = getRequestContext(request);

    await prisma.auditLog.create({
      data: {
        userId,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        details: event.details ? JSON.stringify(event.details) : null,
        status: event.status || 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        country: context.country,
        city: context.city,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

export async function getAuditLogs(
  userId: string,
  options?: {
    action?: AuditAction;
    resource?: AuditResource;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: Record<string, unknown> = { userId };

  if (options?.action) {
    where.action = options.action;
  }

  if (options?.resource) {
    where.resource = options.resource;
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      (where.createdAt as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.createdAt as Record<string, Date>).lte = options.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: parseJsonSafe<Record<string, unknown>>(log.details, {}),
    })),
    total,
  };
}

// Maximum export limit to prevent memory issues
const MAX_EXPORT_LIMIT = 10000;

export async function exportAuditLogs(
  userId: string,
  format: 'json' | 'csv',
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<string> {
  const where: Record<string, unknown> = { userId };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      (where.createdAt as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.createdAt as Record<string, Date>).lte = options.endDate;
    }
  }

  // Apply limit to prevent unbounded queries
  const limit = Math.min(options?.limit ?? MAX_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  if (format === 'csv') {
    const headers = [
      'Timestamp',
      'Action',
      'Resource',
      'Resource ID',
      'Status',
      'IP Address',
      'User Agent',
      'Country',
      'City',
      'Details',
    ];

    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.action,
      log.resource,
      log.resourceId || '',
      log.status,
      log.ipAddress || '',
      log.userAgent || '',
      log.country || '',
      log.city || '',
      log.details || '',
    ]);

    // Sanitize cell to prevent CSV injection attacks
    // Characters that trigger formula execution: = + - @ \t \r
    const sanitizeCell = (cell: string): string => {
      const sanitized = String(cell).replace(/"/g, '""');
      // Prefix potentially dangerous characters with a single quote
      if (/^[=+\-@\t\r]/.test(sanitized)) {
        return `"'${sanitized}"`;
      }
      return `"${sanitized}"`;
    };

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => sanitizeCell(String(cell))).join(',')),
    ].join('\n');
  }

  return JSON.stringify(
    logs.map((log) => ({
      ...log,
      details: parseJsonSafe<Record<string, unknown>>(log.details, {}),
    })),
    null,
    2
  );
}
