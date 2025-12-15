import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuth, type AuthContext } from '@/lib/api/withAuth';
import { success } from '@/lib/api';

const DEFAULT_SETTINGS = {
  defaultPort: 3000,
  defaultSubdomain: '',
  autoReconnect: true,
  keepHistory: 7,
  maxRequests: 1000,
  requirePassword: false,
  defaultExpiration: 'never',
  rateLimit: 100,
};

export const GET = withAuth(async (request: Request, { user, logger }: AuthContext) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default', ...DEFAULT_SETTINGS },
      });
    }

    logger.info('Settings fetched', { userId: user.id });

    return success({
      defaultPort: settings.defaultPort,
      defaultSubdomain: settings.defaultSubdomain,
      autoReconnect: settings.autoReconnect,
      keepHistory: settings.keepHistory,
      maxRequests: settings.maxRequests,
      requirePassword: settings.requirePassword,
      defaultExpiration: settings.defaultExpiration,
      rateLimit: settings.rateLimit,
    });
  } catch (error) {
    logger.error('Failed to get settings', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get settings' } },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: Request, { user, logger }: AuthContext) => {
  try {
    const body = await request.json();
    const {
      defaultPort,
      defaultSubdomain,
      autoReconnect,
      keepHistory,
      maxRequests,
      requirePassword,
      defaultExpiration,
      rateLimit,
    } = body;

    // Validate port
    if (defaultPort !== undefined && (defaultPort < 1 || defaultPort > 65535)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PORT', message: 'Port must be between 1 and 65535' } },
        { status: 400 }
      );
    }

    // Validate keepHistory
    if (keepHistory !== undefined && (keepHistory < 1 || keepHistory > 365)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_KEEP_HISTORY', message: 'Keep history must be between 1 and 365 days' } },
        { status: 400 }
      );
    }

    // Validate maxRequests
    if (maxRequests !== undefined && (maxRequests < 100 || maxRequests > 100000)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_MAX_REQUESTS', message: 'Max requests must be between 100 and 100000' } },
        { status: 400 }
      );
    }

    // Validate rateLimit
    if (rateLimit !== undefined && (rateLimit < 0 || rateLimit > 10000)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_RATE_LIMIT', message: 'Rate limit must be between 0 and 10000' } },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        defaultPort: defaultPort ?? undefined,
        defaultSubdomain: defaultSubdomain ?? undefined,
        autoReconnect: autoReconnect ?? undefined,
        keepHistory: keepHistory ?? undefined,
        maxRequests: maxRequests ?? undefined,
        requirePassword: requirePassword ?? undefined,
        defaultExpiration: defaultExpiration ?? undefined,
        rateLimit: rateLimit ?? undefined,
      },
      create: {
        id: 'default',
        defaultPort: defaultPort ?? DEFAULT_SETTINGS.defaultPort,
        defaultSubdomain: defaultSubdomain ?? DEFAULT_SETTINGS.defaultSubdomain,
        autoReconnect: autoReconnect ?? DEFAULT_SETTINGS.autoReconnect,
        keepHistory: keepHistory ?? DEFAULT_SETTINGS.keepHistory,
        maxRequests: maxRequests ?? DEFAULT_SETTINGS.maxRequests,
        requirePassword: requirePassword ?? DEFAULT_SETTINGS.requirePassword,
        defaultExpiration: defaultExpiration ?? DEFAULT_SETTINGS.defaultExpiration,
        rateLimit: rateLimit ?? DEFAULT_SETTINGS.rateLimit,
      },
    });

    logger.info('Settings updated', { userId: user.id });

    return success({
      defaultPort: settings.defaultPort,
      defaultSubdomain: settings.defaultSubdomain,
      autoReconnect: settings.autoReconnect,
      keepHistory: settings.keepHistory,
      maxRequests: settings.maxRequests,
      requirePassword: settings.requirePassword,
      defaultExpiration: settings.defaultExpiration,
      rateLimit: settings.rateLimit,
    });
  } catch (error) {
    logger.error('Failed to update settings', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: Request, { user, logger }: AuthContext) => {
  try {
    await prisma.settings.upsert({
      where: { id: 'default' },
      update: DEFAULT_SETTINGS,
      create: { id: 'default', ...DEFAULT_SETTINGS },
    });

    logger.info('Settings reset', { userId: user.id });

    return success(DEFAULT_SETTINGS);
  } catch (error) {
    logger.error('Failed to reset settings', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset settings' } },
      { status: 500 }
    );
  }
});
