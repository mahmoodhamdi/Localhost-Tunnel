import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { rateLimiter, RATE_LIMITS, getClientIp, createRateLimitKey } from '@/lib/api/rateLimiter';
import {
  validateRequiredString,
  validateOptionalString,
  VALIDATION_LIMITS,
} from '@/lib/api/validation';

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

    // Rate limiting: 10 team creations per hour
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey('team_create', session.user.id, clientIp);
    const rateLimit = rateLimiter.check(rateLimitKey, RATE_LIMITS.TEAM_CREATE);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many team creations. Please try again later.',
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10240) { // 10KB max
      return NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { name: rawName, slug: rawSlug, description: rawDescription } = body;

    // Validate and sanitize inputs
    let name: string;
    let description: string | null;

    try {
      name = validateRequiredString(rawName, 'Team name', VALIDATION_LIMITS.MAX_NAME_LENGTH);
      description = validateOptionalString(rawDescription, 'Description', VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH);
    } catch (validationError) {
      if (validationError instanceof Error) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validationError.message } },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Generate or validate slug
    let teamSlug = rawSlug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    teamSlug = teamSlug.substring(0, 50); // Limit slug length

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
        name,
        slug: teamSlug,
        description,
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
