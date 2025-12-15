import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      // TODO: Send email with reset link
      // In production, implement email sending using a service like:
      // - SendGrid
      // - AWS SES
      // - Resend
      // - Nodemailer
      //
      // Example:
      // const resetUrl = `${process.env.AUTH_URL}/auth/reset-password?token=${resetToken}`;
      // await sendEmail({
      //   to: email,
      //   subject: 'Password Reset Request',
      //   html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`
      // });

      console.log(`Password reset requested for ${email}. Token: ${resetToken}`);
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link will be sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}
