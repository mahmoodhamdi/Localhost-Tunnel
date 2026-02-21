import { prisma } from '@/lib/db/prisma';
import type { SessionUser } from './withAuth';

/**
 * Authenticate request using API key from X-API-Key header
 * Returns the user associated with the API key, or null if invalid
 */
export async function authenticateApiKey(request: Request): Promise<SessionUser | null> {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return null;

  try {
    const key = await prisma.apiKey.findFirst({
      where: {
        key: apiKey,
        isActive: true,
      },
      include: { user: true },
    });

    if (!key) return null;

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {/* ignore update failures */});

    return {
      id: key.user.id,
      email: key.user.email!,
      name: key.user.name,
      image: key.user.image,
      role: key.user.role,
    };
  } catch {
    return null;
  }
}
