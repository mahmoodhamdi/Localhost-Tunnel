import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// GET /api/invitations/[token] - Get invitation details
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token: params.token },
      include: {
        team: {
          select: { id: true, name: true, slug: true, image: true },
        },
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'EXPIRED', message: 'Invitation has expired' } },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        team: invitation.team,
        invitedBy: invitation.invitedBy,
      },
    });
  } catch (error) {
    console.error('Failed to get invitation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get invitation' } },
      { status: 500 }
    );
  }
}

// POST /api/invitations/[token] - Accept or decline invitation
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use "accept" or "decline"' } },
        { status: 400 }
      );
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token: params.token },
      include: {
        team: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      // Clean up expired invitation
      await prisma.teamInvitation.delete({
        where: { id: invitation.id },
      });

      return NextResponse.json(
        { success: false, error: { code: 'EXPIRED', message: 'Invitation has expired' } },
        { status: 410 }
      );
    }

    // Check if user email matches invitation email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (user?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'This invitation was sent to a different email' } },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      },
    });

    if (existingMember) {
      // Delete invitation since user is already a member
      await prisma.teamInvitation.delete({
        where: { id: invitation.id },
      });

      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'You are already a member of this team' } },
        { status: 409 }
      );
    }

    if (action === 'decline') {
      await prisma.teamInvitation.delete({
        where: { id: invitation.id },
      });

      return NextResponse.json({
        success: true,
        data: { message: 'Invitation declined' },
      });
    }

    // Accept invitation: add user to team and delete invitation
    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.teamInvitation.delete({
        where: { id: invitation.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Invitation accepted',
        team: invitation.team,
        role: invitation.role,
      },
    });
  } catch (error) {
    console.error('Failed to process invitation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process invitation' } },
      { status: 500 }
    );
  }
}
