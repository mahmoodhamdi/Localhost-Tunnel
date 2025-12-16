import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Email sender info
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@localhost-tunnel.dev';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Localhost Tunnel';

// Create transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    // Check if email is configured
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      // Use a mock transporter for development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Email not configured. Using console output for development.');
        transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      } else {
        throw new Error('Email service not configured. Set SMTP_USER and SMTP_PASS environment variables.');
      }
    } else {
      transporter = nodemailer.createTransport(EMAIL_CONFIG);
    }
  }
  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = getTransporter();

    const info = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    // In development with jsonTransport, log the email
    if (process.env.NODE_ENV === 'development' && !EMAIL_CONFIG.auth.user) {
      console.log('📧 Email would be sent:');
      console.log(JSON.parse(info.message));
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/en/auth/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Localhost Tunnel</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>

    <p>Hi${userName ? ` ${userName}` : ''},</p>

    <p>We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Localhost Tunnel. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Localhost Tunnel',
    html,
  });
}

/**
 * Send team invitation email
 */
export async function sendTeamInvitationEmail(
  email: string,
  teamName: string,
  inviterName: string,
  inviteToken: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const acceptUrl = `${baseUrl}/en/invitations/${inviteToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Localhost Tunnel</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">You're Invited to Join a Team!</h2>

    <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Team:</strong> ${teamName}</p>
      <p style="margin: 10px 0 0;"><strong>Your Role:</strong> ${role}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
    </div>

    <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${acceptUrl}" style="color: #667eea; word-break: break-all;">${acceptUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Localhost Tunnel. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `You're invited to join ${teamName} - Localhost Tunnel`,
    html,
  });
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(
  email: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/en/dashboard`;
  const docsUrl = `${baseUrl}/en/docs`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Localhost Tunnel</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Localhost Tunnel!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi${userName ? ` ${userName}` : ''},</p>

    <p>Thank you for signing up! We're excited to have you on board.</p>

    <p>With Localhost Tunnel, you can:</p>

    <ul style="padding-left: 20px;">
      <li>Expose your local development server to the internet</li>
      <li>Share your work with clients and teammates</li>
      <li>Test webhooks and integrations easily</li>
      <li>Inspect and debug HTTP requests</li>
    </ul>

    <h3 style="color: #333;">Getting Started</h3>

    <p>Install the CLI tool:</p>

    <div style="background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px;">
      npm install -g @localhost-tunnel/cli
    </div>

    <p style="margin-top: 20px;">Then run:</p>

    <div style="background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px;">
      lt --port 3000
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">Go to Dashboard</a>
      <a href="${docsUrl}" style="background: #f8f9fa; color: #667eea; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #667eea;">Read Docs</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #666; font-size: 14px;">Need help? Check out our <a href="${docsUrl}" style="color: #667eea;">documentation</a> or reply to this email.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Localhost Tunnel. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Localhost Tunnel!',
    html,
  });
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<{ configured: boolean; error?: string }> {
  try {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      return { configured: false, error: 'SMTP credentials not configured' };
    }

    const transport = getTransporter();
    await transport.verify();
    return { configured: true };
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Failed to verify email configuration',
    };
  }
}
