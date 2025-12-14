import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// DELETE /api/keys/[id] - Revoke an API key
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check if API key exists and belongs to user
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } },
        { status: 404 }
      );
    }

    // Soft delete - just mark as inactive
    await prisma.apiKey.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'API key revoked successfully' },
    });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key' } },
      { status: 500 }
    );
  }
}
