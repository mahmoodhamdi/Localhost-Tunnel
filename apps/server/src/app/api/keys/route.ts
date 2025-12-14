import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

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

    const body = await request.json();
    const { name, expiresIn } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    // Generate a secure API key
    const keyBytes = crypto.randomBytes(32);
    const key = `lt_${keyBytes.toString('hex')}`;
    const keyPrefix = key.substring(0, 10);

    // Calculate expiration date if provided
    let expiresAt: Date | null = null;
    if (expiresIn && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
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
