import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getTunnelPublicKey, generateTunnelKeys } from '@/lib/security/encryption';

// GET /api/tunnels/[id]/encryption/key - Get public key
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

    const keyInfo = await getTunnelPublicKey(tunnelId);

    if (!keyInfo) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No encryption key found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        publicKey: keyInfo.publicKey,
        algorithm: keyInfo.algorithm,
        expiresAt: keyInfo.expiresAt,
        createdAt: keyInfo.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to get encryption key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get encryption key' } },
      { status: 500 }
    );
  }
}

// POST /api/tunnels/[id]/encryption/key - Generate new key pair
export async function POST(
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

    // Verify tunnel exists and user has admin access
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

    const keyInfo = await generateTunnelKeys(tunnelId);

    return NextResponse.json({
      success: true,
      data: {
        publicKey: keyInfo.publicKey,
        algorithm: keyInfo.algorithm,
        expiresAt: keyInfo.expiresAt,
        createdAt: keyInfo.createdAt,
        message: 'New encryption keys generated',
      },
    });
  } catch (error) {
    console.error('Failed to generate encryption keys:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate encryption keys' } },
      { status: 500 }
    );
  }
}
