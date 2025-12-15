import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import {
  getOrCreateEncryptionSettings,
  updateEncryptionSettings,
  generateTunnelKeys,
  getTunnelPublicKey,
} from '@/lib/security/encryption';

// GET /api/tunnels/[id]/encryption - Get encryption settings
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: tunnelId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Verify tunnel exists and belongs to user
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        id: tunnelId,
        OR: [
          { userId: session.user.id },
          { team: { members: { some: { userId: session.user.id } } } },
        ],
      },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    const settings = await getOrCreateEncryptionSettings(tunnelId);
    const keyInfo = await getTunnelPublicKey(tunnelId);

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        hasKey: !!keyInfo,
        keyExpiry: keyInfo?.expiresAt || null,
        keyAlgorithm: keyInfo?.algorithm || null,
      },
    });
  } catch (error) {
    console.error('Failed to get encryption settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get encryption settings' } },
      { status: 500 }
    );
  }
}

// PUT /api/tunnels/[id]/encryption - Update encryption settings
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: tunnelId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Verify tunnel exists and belongs to user
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        id: tunnelId,
        OR: [
          { userId: session.user.id },
          { team: { members: { some: { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } } } } },
        ],
      },
    });

    if (!tunnel) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { enabled, mode, keyRotationDays } = body;

    // Validate mode
    if (mode && !['E2E', 'TRANSPORT', 'NONE'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mode must be E2E, TRANSPORT, or NONE' } },
        { status: 400 }
      );
    }

    // Validate keyRotationDays
    if (keyRotationDays !== undefined && (keyRotationDays < 1 || keyRotationDays > 365)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Key rotation days must be between 1 and 365' } },
        { status: 400 }
      );
    }

    const settings = await updateEncryptionSettings(tunnelId, {
      enabled,
      mode,
      keyRotationDays,
    });

    // Generate keys if enabling encryption and no keys exist
    if (enabled) {
      const existingKey = await getTunnelPublicKey(tunnelId);
      if (!existingKey) {
        await generateTunnelKeys(tunnelId);
      }
    }

    const keyInfo = await getTunnelPublicKey(tunnelId);

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        hasKey: !!keyInfo,
        keyExpiry: keyInfo?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Failed to update encryption settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update encryption settings' } },
      { status: 500 }
    );
  }
}
