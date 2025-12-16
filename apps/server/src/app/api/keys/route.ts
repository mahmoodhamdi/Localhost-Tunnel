import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';
import { rateLimiter, RATE_LIMITS, getClientIp, createRateLimitKey } from '@/lib/api/rateLimiter';
import {
  validateRequiredString,
  validateExpiresIn,
  VALIDATION_LIMITS,
} from '@/lib/api/validation';

// GET /api/keys - List user's API keys
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error('Failed to list API keys:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list API keys' } },
      { status: 500 }
    );
  }
}

// POST /api/keys - Create a new API key
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Rate limiting: 10 API key creations per hour
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey('api_key_create', session.user.id, clientIp);
    const rateLimit = rateLimiter.check(rateLimitKey, RATE_LIMITS.API_KEY_CREATE);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many API key creations. Please try again later.',
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    const body = await request.json();
    const { name: rawName, expiresIn: rawExpiresIn } = body;

    // Validate inputs
    let name: string;
    let expiresInSeconds: number | null;

    try {
      name = validateRequiredString(rawName, 'Name', VALIDATION_LIMITS.MAX_NAME_LENGTH);
      expiresInSeconds = validateExpiresIn(rawExpiresIn);
    } catch (validationError) {
      if (validationError instanceof Error) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validationError.message } },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Generate a secure API key
    const keyBytes = crypto.randomBytes(32);
    const key = `lt_${keyBytes.toString('hex')}`;
    const keyPrefix = key.substring(0, 10);

    // Calculate expiration date if provided
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key,
        keyPrefix,
        expiresAt,
        userId: session.user.id,
      },
    });

    // Return the full key only once
    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Full key - only shown once!
        keyPrefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key' } },
      { status: 500 }
    );
  }
}
