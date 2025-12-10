import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateSubdomain, validateSubdomain } from '@/lib/tunnel/subdomain';
import { hashPassword } from '@/lib/tunnel/auth';

export async function GET() {
  try {
    const tunnels = await prisma.tunnel.findMany({
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
    } = body;

    // Validate port
    if (!localPort || localPort < 1 || localPort > 65535) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PORT', message: 'Invalid port number' } },
        { status: 400 }
      );
    }

    // Handle subdomain
    let subdomain = requestedSubdomain?.toLowerCase().trim();

    if (subdomain) {
      const validation = validateSubdomain(subdomain);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_SUBDOMAIN', message: validation.error } },
          { status: 400 }
        );
      }

      // Check if subdomain is taken
      const existing = await prisma.tunnel.findUnique({
        where: { subdomain },
      });

      if (existing && existing.isActive) {
        return NextResponse.json(
          { success: false, error: { code: 'SUBDOMAIN_TAKEN', message: 'Subdomain is already in use' } },
          { status: 400 }
        );
      }
    } else {
      subdomain = generateSubdomain();
    }

    // Hash password if provided
    const hashedPassword = password ? await hashPassword(password) : null;

    // Calculate expiration
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // Create tunnel
    const tunnel = await prisma.tunnel.upsert({
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
      },
    });

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const publicUrl = `http://${subdomain}.${domain}`;

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
