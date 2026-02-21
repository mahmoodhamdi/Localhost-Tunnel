import { prisma } from '@/lib/db/prisma';
import { withAuth, success, ApiException } from '@/lib/api';

// GET: List user invoices with pagination
export const GET = withAuth(async (request, { user, logger }) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;

  logger.info('Fetching invoices', { userId: user.id, page, limit });

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        subtotal: true,
        tax: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        currency: true,
        provider: true,
        hostedInvoiceUrl: true,
        pdfUrl: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.invoice.count({ where: { userId: user.id } }),
  ]);

  return success({
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
