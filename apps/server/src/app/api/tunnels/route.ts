import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateSubdomain, validateSubdomain } from '@/lib/tunnel/subdomain';
import { hashPassword } from '@/lib/tunnel/auth';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Only return tunnels that belong to the user or their teams
    const tunnels = await prisma.tunnel.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { team: { members: { some: { userId: session.user.id } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: tunnels.map((t) => ({
        id: t.id,
        subdomain: t.subdomain,
        localPort: t.localPort,
        localHost: t.localHost,
        protocol: t.protocol,
        isActive: t.isActive,
        expiresAt: t.expiresAt,
        inspect: t.inspect,
        totalRequests: t.totalRequests,
        totalBytes: Number(t.totalBytes),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        lastActiveAt: t.lastActiveAt,
        hasPassword: !!t.password,
      })),
    });
  } catch (error) {
    console.error('Failed to get tunnels:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get tunnels' } },
      { status: 500 }
    );
  }
}

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
    const {
      localPort,
      localHost = 'localhost',
      subdomain: requestedSubdomain,
      protocol = 'HTTP',
      password,
      ipWhitelist,
      expiresIn,
      inspect = true,
      teamId,
    } = body;

    // Validate port
    if (!localPort || localPort < 1 || localPort > 65535) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PORT', message: 'Invalid port number' } },
        { status: 400 }
      );
    }

    // If teamId provided, verify user is member of the team
    if (teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId,
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
        },
      });

      if (!teamMember) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this team' } },
          { status: 403 }
        );
      }
    }

    // Handle subdomain validation before transaction
    let requestedSubdomainValidated = requestedSubdomain?.toLowerCase().trim();

    if (requestedSubdomainValidated) {
      const validation = validateSubdomain(requestedSubdomainValidated);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_SUBDOMAIN', message: validation.error } },
          { status: 400 }
        );
      }
    }

    // Hash password if provided (outside transaction for performance)
    const hashedPassword = password ? await hashPassword(password) : null;

    // Calculate expiration
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // Use transaction to prevent race conditions in subdomain allocation
    const MAX_RETRIES = 5;
    let tunnel;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        tunnel = await prisma.$transaction(async (tx) => {
          let subdomain: string;

          if (requestedSubdomainValidated) {
            subdomain = requestedSubdomainValidated;

            // Check if subdomain is taken (within transaction for consistency)
            const existing = await tx.tunnel.findUnique({
              where: { subdomain },
            });

            if (existing && existing.isActive) {
              throw new Error('SUBDOMAIN_TAKEN');
            }
          } else {
            // Generate unique subdomain with collision detection
            subdomain = generateSubdomain();

            // Verify it doesn't exist
            const existing = await tx.tunnel.findUnique({
              where: { subdomain },
            });

            if (existing) {
              // Collision - will retry with new subdomain
              throw new Error('SUBDOMAIN_COLLISION');
            }
          }

          // Create or update tunnel atomically
          return await tx.tunnel.upsert({
            where: { subdomain },
            update: {
              localPort,
              localHost,
              protocol,
              password: hashedPassword,
              ipWhitelist,
              expiresAt,
              inspect,
              isActive: true,
              lastActiveAt: new Date(),
            },
            create: {
              subdomain,
              localPort,
              localHost,
              protocol,
              password: hashedPassword,
              ipWhitelist,
              expiresAt,
              inspect,
              isActive: true,
              userId: teamId ? null : session.user.id,
              teamId: teamId || null,
            },
          });
        });

        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;

        if (error instanceof Error) {
          if (error.message === 'SUBDOMAIN_TAKEN') {
            return NextResponse.json(
              { success: false, error: { code: 'SUBDOMAIN_TAKEN', message: 'Subdomain is already in use' } },
              { status: 400 }
            );
          }

          if (error.message === 'SUBDOMAIN_COLLISION' && !requestedSubdomainValidated) {
            // Retry with new generated subdomain
            continue;
          }
        }

        // For other errors (like unique constraint violations), retry
        if (attempt < MAX_RETRIES - 1) {
          continue;
        }
      }
    }

    if (!tunnel) {
      console.error('Failed to create tunnel after retries:', lastError);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to allocate subdomain' } },
        { status: 500 }
      );
    }

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const publicUrl = `http://${tunnel.subdomain}.${domain}`;

    return NextResponse.json({
      success: true,
      data: {
        id: tunnel.id,
        subdomain: tunnel.subdomain,
        publicUrl,
        localPort: tunnel.localPort,
        localHost: tunnel.localHost,
        protocol: tunnel.protocol,
        hasPassword: !!tunnel.password,
        expiresAt: tunnel.expiresAt,
        inspect: tunnel.inspect,
        createdAt: tunnel.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create tunnel:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create tunnel' } },
      { status: 500 }
    );
  }
}
