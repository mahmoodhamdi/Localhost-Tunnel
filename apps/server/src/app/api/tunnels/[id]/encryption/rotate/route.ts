import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateTunnelKeys, isEncryptionEnabled } from '@/lib/security/encryption';

// POST /api/tunnels/[id]/encryption/rotate - Rotate encryption keys
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

    // Check if encryption is enabled
    const enabled = await isEncryptionEnabled(tunnelId);
    if (!enabled) {
      return NextResponse.json(
        { success: false, error: { code: 'ENCRYPTION_DISABLED', message: 'Encryption is not enabled for this tunnel' } },
        { status: 400 }
      );
    }

    // Generate new keys
    const keyInfo = await generateTunnelKeys(tunnelId);

    return NextResponse.json({
      success: true,
      data: {
        publicKey: keyInfo.publicKey,
        algorithm: keyInfo.algorithm,
        expiresAt: keyInfo.expiresAt,
        rotatedAt: new Date(),
        message: 'Encryption keys rotated successfully',
      },
    });
  } catch (error) {
    console.error('Failed to rotate encryption keys:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate encryption keys' } },
      { status: 500 }
    );
  }
}
