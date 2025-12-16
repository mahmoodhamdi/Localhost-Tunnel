import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { randomBytes } from 'crypto';
import { sendTeamInvitationEmail } from '@/lib/email/emailService';

// Helper to get user's role in team
async function getUserTeamRole(teamId: string, userId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!team) return null;

  return team.ownerId === userId
    ? 'OWNER'
    : team.members[0]?.role || null;
}

// GET /api/teams/[id]/invitations - List pending invitations
export async function GET(
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

    const role = await getUserTeamRole(params.id, session.user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Only owner and admin can view invitations
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to view invitations' } },
        { status: 403 }
      );
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: { teamId: params.id },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedBy,
      })),
    });
  } catch (error) {
    console.error('Failed to list invitations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list invitations' } },
      { status: 500 }
    );
  }
}

// POST /api/teams/[id]/invitations - Send invitation
export async function POST(
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

    const body = await request.json();
    const { email, role = 'MEMBER' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid email is required' } },
        { status: 400 }
      );
    }

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } },
        { status: 400 }
      );
    }

    const userRole = await getUserTeamRole(params.id, session.user.id);

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Only owner and admin can invite
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to invite members' } },
        { status: 403 }
      );
    }

    // Admin can only invite members, not other admins
    if (userRole === 'ADMIN' && role === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admins cannot invite other admins' } },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        teamId: params.id,
        user: { email: email.toLowerCase() },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'User is already a team member' } },
        { status: 409 }
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        teamId: params.id,
        email: email.toLowerCase(),
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Invitation already pending for this email' } },
        { status: 409 }
      );
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.teamInvitation.create({
      data: {
        email: email.toLowerCase(),
        role,
        token,
        expiresAt,
        teamId: params.id,
        invitedById: session.user.id,
      },
      include: {
        team: {
          select: { name: true, slug: true },
        },
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Send invitation email
    const emailResult = await sendTeamInvitationEmail(
      invitation.email,
      invitation.team.name,
      invitation.invitedBy.name || invitation.invitedBy.email || 'A team member',
      token,
      invitation.role
    );

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Continue anyway - invitation is created, user can still use the link
    }

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        team: invitation.team,
        invitedBy: invitation.invitedBy,
        emailSent: emailResult.success,
      },
    });
  } catch (error) {
    console.error('Failed to create invitation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invitation' } },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id]/invitations - Cancel invitation
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

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invitation ID is required' } },
        { status: 400 }
      );
    }

    const userRole = await getUserTeamRole(params.id, session.user.id);

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found or access denied' } },
        { status: 404 }
      );
    }

    // Only owner and admin can cancel invitations
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to cancel invitations' } },
        { status: 403 }
      );
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.teamId !== params.id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        { status: 404 }
      );
    }

    await prisma.teamInvitation.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Invitation cancelled successfully' },
    });
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel invitation' } },
      { status: 500 }
    );
  }
}
