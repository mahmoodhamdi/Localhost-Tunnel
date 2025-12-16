import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { rateLimiter, RATE_LIMITS, getClientIp, createRateLimitKey } from '@/lib/api/rateLimiter';
import {
  validateEmailInput,
  validatePasswordInput,
  validateOptionalString,
  VALIDATION_LIMITS,
} from '@/lib/api/validation';

export async function POST(request: Request) {
  try {
    // Rate limiting: 5 registration attempts per hour per IP
    const clientIp = getClientIp(request);
    const rateLimitKey = createRateLimitKey('register', null, clientIp);
    const rateLimit = rateLimiter.check(rateLimitKey, RATE_LIMITS.REGISTER);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many registration attempts. Please try again later.',
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
    if (contentLength && parseInt(contentLength, 10) > 10240) { // 10KB max for registration
      return NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { email: rawEmail, password: rawPassword, name: rawName } = body;

    // Validate and sanitize inputs using validation library
    let email: string;
    let password: string;
    let name: string | null;

    try {
      email = validateEmailInput(rawEmail);
      password = validatePasswordInput(rawPassword);
      name = validateOptionalString(rawName, 'Name', VALIDATION_LIMITS.MAX_NAME_LENGTH);
    } catch (validationError) {
      if (validationError instanceof Error) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: validationError.message } },
          { status: 400 }
        );
      }
      throw validationError;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register user' } },
      { status: 500 }
    );
  }
}
