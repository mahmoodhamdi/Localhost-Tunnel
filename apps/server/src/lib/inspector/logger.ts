import { prisma } from '../db/prisma';
import type { RequestLog } from '@localhost-tunnel/shared';

interface LogRequestOptions {
  tunnelId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query?: string;
  ip?: string;
  userAgent?: string;
}

interface LogResponseOptions {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  responseTime: number;
}

export async function logRequest(options: LogRequestOptions): Promise<string> {
  const request = await prisma.request.create({
    data: {
      tunnelId: options.tunnelId,
      method: options.method,
      path: options.path,
      headers: JSON.stringify(options.headers),
      body: options.body,
      query: options.query,
      ip: options.ip,
      userAgent: options.userAgent,
    },
  });

  return request.id;
}

export async function logResponse(options: LogResponseOptions): Promise<void> {
  await prisma.request.update({
    where: { id: options.requestId },
    data: {
      statusCode: options.statusCode,
      responseHeaders: JSON.stringify(options.headers),
      responseBody: options.body,
      responseTime: options.responseTime,
    },
  });

  // Update tunnel bytes
  const bodyLength = options.body?.length || 0;
  const request = await prisma.request.findUnique({
    where: { id: options.requestId },
    select: { tunnelId: true, body: true },
  });

  if (request) {
    await prisma.tunnel.update({
      where: { id: request.tunnelId },
      data: {
        totalBytes: {
          increment: bodyLength + (request.body?.length || 0),
        },
      },
    });
  }
}

export async function getRequests(
  tunnelId: string,
  options: {
    limit?: number;
    offset?: number;
    method?: string;
    statusCode?: number;
  } = {},
): Promise<RequestLog[]> {
  const { limit = 100, offset = 0, method, statusCode } = options;

  const where: Record<string, unknown> = { tunnelId };
  if (method) where.method = method;
  if (statusCode) where.statusCode = statusCode;

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return requests.map((r) => ({
    id: r.id,
    tunnelId: r.tunnelId,
    method: r.method,
    path: r.path,
    headers: JSON.parse(r.headers),
    body: r.body || undefined,
    query: r.query || undefined,
    statusCode: r.statusCode || undefined,
    responseHeaders: r.responseHeaders ? JSON.parse(r.responseHeaders) : undefined,
    responseBody: r.responseBody || undefined,
    responseTime: r.responseTime || undefined,
    ip: r.ip || undefined,
    userAgent: r.userAgent || undefined,
    createdAt: r.createdAt,
  }));
}

export async function getRequestById(requestId: string): Promise<RequestLog | null> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) return null;

  return {
    id: request.id,
    tunnelId: request.tunnelId,
    method: request.method,
    path: request.path,
    headers: JSON.parse(request.headers),
    body: request.body || undefined,
    query: request.query || undefined,
    statusCode: request.statusCode || undefined,
    responseHeaders: request.responseHeaders ? JSON.parse(request.responseHeaders) : undefined,
    responseBody: request.responseBody || undefined,
    responseTime: request.responseTime || undefined,
    ip: request.ip || undefined,
    userAgent: request.userAgent || undefined,
    createdAt: request.createdAt,
  };
}

export async function clearRequests(tunnelId: string): Promise<void> {
  await prisma.request.deleteMany({
    where: { tunnelId },
  });
}

export async function deleteOldRequests(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await prisma.request.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}
