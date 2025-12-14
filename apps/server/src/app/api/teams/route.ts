import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

// GET /api/teams - List user's teams
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Get teams where user is owner or member
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { tunnels: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: teams.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        image: team.image,
        owner: team.owner,
        memberCount: team._count.members,
        tunnelCount: team._count.tunnels,
        role: team.ownerId === session.user.id
          ? 'OWNER'
          : team.members.find((m) => m.userId === session.user.id)?.role || 'MEMBER',
        createdAt: team.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to list teams:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list teams' } },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team
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
    const { name, slug, description } = body;

    // Validate name
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Team name is required' } },
        { status: 400 }
      );
    }

    // Generate or validate slug
    let teamSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Check if slug is unique
    const existingTeam = await prisma.team.findUnique({
      where: { slug: teamSlug },
    });

    if (existingTeam) {
      // Append random string to make unique
      teamSlug = `${teamSlug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Create team
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        slug: teamSlug,
        description: description?.trim() || null,
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        owner: team.owner,
        members: team.members.map((m) => ({
          id: m.id,
          role: m.role,
          user: m.user,
        })),
        createdAt: team.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create team:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create team' } },
      { status: 500 }
    );
  }
}
