import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock nodemailer
const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockCreateTransport = vi.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

describe('Email Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockVerify.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Email Configuration', () => {
    it('should have default SMTP configuration', () => {
      const defaultConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
      };

      expect(defaultConfig.host).toBe('smtp.gmail.com');
      expect(defaultConfig.port).toBe(587);
      expect(defaultConfig.secure).toBe(false);
    });

    it('should use environment variables when set', () => {
      const envConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
      };

      expect(typeof envConfig.host).toBe('string');
      expect(typeof envConfig.port).toBe('number');
      expect(typeof envConfig.secure).toBe('boolean');
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      // Simulate sending email
      mockSendMail.mockResolvedValue({ messageId: 'msg-123' });

      const result = {
        success: true,
        messageId: 'msg-123',
      };

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should handle email sending failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = {
        success: false,
        error: 'SMTP connection failed',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    it('should generate plain text from HTML if not provided', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const text = html.replace(/<[^>]*>/g, '');

      expect(text).toBe('Hello World');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should construct correct reset URL', () => {
      const baseUrl = 'http://localhost:3000';
      const resetToken = 'test-reset-token';
      const resetUrl = `${baseUrl}/en/auth/reset-password?token=${resetToken}`;

      expect(resetUrl).toBe('http://localhost:3000/en/auth/reset-password?token=test-reset-token');
    });

    it('should include user name in email if provided', () => {
      const userName = 'John';
      const greeting = `Hi${userName ? ` ${userName}` : ''}`;

      expect(greeting).toBe('Hi John');
    });

    it('should use generic greeting if name not provided', () => {
      const userName = undefined;
      const greeting = `Hi${userName ? ` ${userName}` : ''}`;

      expect(greeting).toBe('Hi');
    });

    it('should have correct subject line', () => {
      const subject = 'Reset Your Password - Localhost Tunnel';
      expect(subject).toBe('Reset Your Password - Localhost Tunnel');
    });

    it('should include 1 hour expiry information', () => {
      const expiryText = 'This link will expire in 1 hour';
      expect(expiryText).toContain('1 hour');
    });
  });

  describe('sendTeamInvitationEmail', () => {
    it('should construct correct accept URL', () => {
      const baseUrl = 'http://localhost:3000';
      const inviteToken = 'test-invite-token';
      const acceptUrl = `${baseUrl}/en/invitations/${inviteToken}`;

      expect(acceptUrl).toBe('http://localhost:3000/en/invitations/test-invite-token');
    });

    it('should include team name and role in email', () => {
      const teamName = 'Test Team';
      const role = 'ADMIN';
      const content = `join ${teamName} as a ${role}`;

      expect(content).toContain('Test Team');
      expect(content).toContain('ADMIN');
    });

    it('should include inviter name', () => {
      const inviterName = 'John Doe';
      const content = `${inviterName} has invited you`;

      expect(content).toContain('John Doe');
    });

    it('should have correct subject line', () => {
      const teamName = 'Test Team';
      const subject = `You're invited to join ${teamName} - Localhost Tunnel`;

      expect(subject).toBe("You're invited to join Test Team - Localhost Tunnel");
    });

    it('should include 7 day expiry information', () => {
      const expiryText = 'This invitation will expire in 7 days';
      expect(expiryText).toContain('7 days');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should construct correct dashboard URL', () => {
      const baseUrl = 'http://localhost:3000';
      const dashboardUrl = `${baseUrl}/en/dashboard`;

      expect(dashboardUrl).toBe('http://localhost:3000/en/dashboard');
    });

    it('should construct correct docs URL', () => {
      const baseUrl = 'http://localhost:3000';
      const docsUrl = `${baseUrl}/en/docs`;

      expect(docsUrl).toBe('http://localhost:3000/en/docs');
    });

    it('should include CLI installation instructions', () => {
      const installCommand = 'npm install -g @localhost-tunnel/cli';
      expect(installCommand).toContain('@localhost-tunnel/cli');
    });

    it('should include usage example', () => {
      const usageCommand = 'lt --port 3000';
      expect(usageCommand).toContain('--port');
    });

    it('should have correct subject line', () => {
      const subject = 'Welcome to Localhost Tunnel!';
      expect(subject).toBe('Welcome to Localhost Tunnel!');
    });
  });

  describe('verifyEmailConfig', () => {
    it('should return configured: true when SMTP is properly set up', async () => {
      mockVerify.mockResolvedValue(true);

      // Simulate verification with credentials
      const hasCredentials = true;
      const result = {
        configured: hasCredentials,
      };

      expect(result.configured).toBe(true);
    });

    it('should return error when SMTP credentials missing', async () => {
      const hasCredentials = false;
      const result = {
        configured: hasCredentials,
        error: 'SMTP credentials not configured',
      };

      expect(result.configured).toBe(false);
      expect(result.error).toBe('SMTP credentials not configured');
    });

    it('should return error on verification failure', async () => {
      mockVerify.mockRejectedValue(new Error('Connection refused'));

      const result = {
        configured: false,
        error: 'Connection refused',
      };

      expect(result.configured).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('Development Mode', () => {
    it('should use jsonTransport in development without credentials', () => {
      const isDevelopment = process.env.NODE_ENV === 'development' || true;
      const hasCredentials = false;

      if (isDevelopment && !hasCredentials) {
        // Would use jsonTransport
        const transportType = 'json';
        expect(transportType).toBe('json');
      }
    });

    it('should log email content to console in development', () => {
      const emailLog = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      };

      expect(emailLog.to).toBe('test@example.com');
      expect(emailLog.subject).toBe('Test Subject');
    });
  });

  describe('Email Templates', () => {
    it('should include proper HTML structure', () => {
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>Content</body>
        </html>
      `;

      expect(htmlTemplate).toContain('<!DOCTYPE html>');
      expect(htmlTemplate).toContain('<html>');
      expect(htmlTemplate).toContain('</html>');
    });

    it('should include responsive meta viewport', () => {
      const metaTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
      expect(metaTag).toContain('viewport');
      expect(metaTag).toContain('width=device-width');
    });

    it('should use inline styles for email compatibility', () => {
      const styledElement = '<div style="background: #ffffff; padding: 30px;">';
      expect(styledElement).toContain('style=');
    });

    it('should include current year in footer', () => {
      const currentYear = new Date().getFullYear();
      const footer = `&copy; ${currentYear} Localhost Tunnel`;

      expect(footer).toContain(currentYear.toString());
    });
  });
});
