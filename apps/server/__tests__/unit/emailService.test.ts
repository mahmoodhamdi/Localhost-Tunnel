import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

// Store original env
const originalEnv = { ...process.env };

describe('Email Service', () => {
  let mockSendMail: ReturnType<typeof vi.fn>;
  let mockTransporter: { sendMail: typeof mockSendMail };

  beforeEach(() => {
    vi.resetModules();
    mockSendMail = vi.fn();
    mockTransporter = { sendMail: mockSendMail };
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);

    // Reset env
    process.env = { ...originalEnv };
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'password123';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockSendMail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['recipient@example.com'],
      });

      const { sendEmail } = await import('../../src/lib/email/emailService');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should handle email sending failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const { sendEmail } = await import('../../src/lib/email/emailService');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP connection failed');
    });

    it('should use text fallback when not provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-456' });

      const { sendEmail } = await import('../../src/lib/email/emailService');

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello <strong>World</strong></p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
        })
      );
    });

    it('should use provided text content', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-789' });

      const { sendEmail } = await import('../../src/lib/email/emailService');

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>HTML Content</p>',
        text: 'Plain text content',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text content',
        })
      );
    });

    it('should handle non-Error throws', async () => {
      mockSendMail.mockRejectedValue('string error');

      const { sendEmail } = await import('../../src/lib/email/emailService');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send email');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'reset-123' });
      process.env.NEXTAUTH_URL = 'http://localhost:3000';

      const { sendPasswordResetEmail } = await import('../../src/lib/email/emailService');

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'reset-token-abc',
        'John Doe'
      );

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Password'),
        })
      );
    });

    it('should include reset URL in email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'reset-456' });
      process.env.NEXTAUTH_URL = 'https://app.example.com';

      const { sendPasswordResetEmail } = await import('../../src/lib/email/emailService');

      await sendPasswordResetEmail('user@example.com', 'token-xyz');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('token-xyz');
    });
  });

  describe('sendTeamInvitationEmail', () => {
    it('should send team invitation email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'invite-123' });

      const { sendTeamInvitationEmail } = await import('../../src/lib/email/emailService');

      const result = await sendTeamInvitationEmail(
        'invitee@example.com',
        'Team Alpha',
        'John Doe',
        'invite-token-abc'
      );

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invitee@example.com',
          subject: expect.stringContaining('Team'),
        })
      );
    });

    it('should include team name in email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'invite-456' });

      const { sendTeamInvitationEmail } = await import('../../src/lib/email/emailService');

      await sendTeamInvitationEmail(
        'invitee@example.com',
        'Development Team',
        'Jane Smith',
        'token-123'
      );

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Development Team');
    });
  });

  describe('sendEmail generic', () => {
    it('should handle tunnel notification email scenario', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'tunnel-123' });

      const { sendEmail } = await import('../../src/lib/email/emailService');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Tunnel Connected',
        html: '<p>Your tunnel my-tunnel is now connected</p>',
      });

      expect(result.success).toBe(true);
    });

    it('should handle disconnected notification scenario', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'tunnel-456' });

      const { sendEmail } = await import('../../src/lib/email/emailService');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Tunnel Disconnected',
        html: '<p>Your tunnel my-tunnel has disconnected</p>',
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('disconnected');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'welcome-123' });

      const { sendWelcomeEmail } = await import('../../src/lib/email/emailService');

      const result = await sendWelcomeEmail('newuser@example.com', 'New User');

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@example.com',
          subject: expect.stringContaining('Welcome'),
        })
      );
    });
  });

  describe('development mode', () => {
    it('should use json transport in development without SMTP config', async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({
          messageId: 'dev-123',
          message: JSON.stringify({ to: 'test@example.com' }),
        }),
      } as any);

      const { sendEmail } = await import('../../src/lib/email/emailService');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
    });
  });
});
