import { prisma } from '@/lib/db/prisma';
import { withAuth, success, ApiException, getParam } from '@/lib/api';

// GET: List user payment methods
export const GET = withAuth(async (_request, { user, logger }) => {
  logger.info('Fetching payment methods', { userId: user.id });

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      provider: true,
      type: true,
      cardBrand: true,
      cardLast4: true,
      cardExpMonth: true,
      cardExpYear: true,
      cardCountry: true,
      walletType: true,
      walletPhone: true,
      isDefault: true,
      createdAt: true,
    },
  });

  return success(paymentMethods);
});

// DELETE: Remove a payment method by ID (passed as query param)
export const DELETE = withAuth(async (request, { user, logger }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    throw ApiException.badRequest('Payment method ID is required', 'MISSING_PARAM');
  }

  logger.info('Deleting payment method', { userId: user.id, paymentMethodId: id });

  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { id, userId: user.id },
  });

  if (!paymentMethod) {
    throw ApiException.notFound('Payment method not found');
  }

  await prisma.paymentMethod.update({
    where: { id },
    data: { isActive: false },
  });

  return success({ id });
});
