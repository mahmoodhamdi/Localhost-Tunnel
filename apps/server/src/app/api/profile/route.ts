import { prisma } from '@/lib/db/prisma';
import { withAuth, parseBody, ApiException, success } from '@/lib/api';
import { validateOptionalString } from '@/lib/api/validation';
import bcrypt from 'bcryptjs';

// GET: Return current user profile
export const GET = withAuth(async (_request, { user, logger }) => {
  logger.info('Fetching profile', { userId: user.id });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });

  if (!profile) {
    throw ApiException.notFound('User not found');
  }

  return success(profile);
});

// PATCH: Update name and/or image
export const PATCH = withAuth(async (request, { user, logger }) => {
  const body = await parseBody<{ name?: unknown; image?: unknown }>(request);

  const name = validateOptionalString(body.name, 'Name', 100);
  const image = validateOptionalString(body.image, 'Image', 2048);

  logger.info('Updating profile', { userId: user.id });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== null ? { name } : {}),
      ...(image !== null ? { image } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });

  return success(updated);
});

// PUT: Change password
export const PUT = withAuth(async (request, { user, logger }) => {
  const body = await parseBody<{
    currentPassword?: unknown;
    newPassword?: unknown;
  }>(request, { requiredFields: ['currentPassword', 'newPassword'] });

  if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
    throw ApiException.badRequest('Current password is required', 'VALIDATION_ERROR');
  }

  if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
    throw ApiException.badRequest('New password must be at least 8 characters', 'VALIDATION_ERROR');
  }

  if (body.newPassword.length > 128) {
    throw ApiException.badRequest('New password must be at most 128 characters', 'VALIDATION_ERROR');
  }

  logger.info('Changing password', { userId: user.id });

  // Fetch stored hash
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  if (!dbUser?.password) {
    throw ApiException.badRequest('No password set on this account. Use OAuth to sign in.', 'NO_PASSWORD');
  }

  const isValid = await bcrypt.compare(body.currentPassword, dbUser.password);
  if (!isValid) {
    throw ApiException.badRequest('Current password is incorrect', 'INCORRECT_PASSWORD');
  }

  const hashed = await bcrypt.hash(body.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return success({ message: 'Password changed successfully' });
});
