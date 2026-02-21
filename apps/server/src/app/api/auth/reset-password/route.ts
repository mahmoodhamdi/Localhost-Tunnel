import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { rateLimiter, RATE_LIMITS, getClientIp, createRateLimitKey } from '@/lib/api/rateLimiter';
import { validatePasswordInput } from '@/lib/api/validation';

export async function POST(request: Request) {
  try {
    // Rate limiting: 3 password reset attempts per hour per IP
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey('reset-password', null, clientIp);
    const rateLimit = rateLimiter.check(rateLimitKey, RATE_LIMITS.PASSWORD_RESET);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many password reset attempts. Please try again later.',
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
    if (contentLength && parseInt(contentLength, 10) > 10240) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { token, password: rawPassword } = body;

    // Validate token presence
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reset token is required' } },
        { status: 400 }
      );
    }

    // Validate password using shared validation
    let password: string;
    try {
      password = validatePasswordInput(rawPassword);
    } catch (validationError) {
      if (validationError instanceof Error) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validationError.message } },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Look up the user by token and verify it has not expired
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token.trim(),
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired password reset token',
          },
        },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user: set new password and clear the reset token fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset password' } },
      { status: 500 }
    );
  }
}
