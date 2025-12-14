import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('User Authentication Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await bcrypt.compare('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate unique hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Email Validation', () => {
    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('Password Validation', () => {
    const validatePassword = (password: string): { valid: boolean; error?: string } => {
      if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
      }
      return { valid: true };
    };

    it('should accept valid passwords', () => {
      expect(validatePassword('password123').valid).toBe(true);
      expect(validatePassword('12345678').valid).toBe(true);
      expect(validatePassword('abcdefgh').valid).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(validatePassword('short').valid).toBe(false);
      expect(validatePassword('1234567').valid).toBe(false);
      expect(validatePassword('').valid).toBe(false);
    });

    it('should return error message for invalid passwords', () => {
      const result = validatePassword('short');
      expect(result.error).toBe('Password must be at least 8 characters');
    });
  });

  describe('API Key Generation', () => {
    const generateApiKey = (): string => {
      const chars = 'abcdef0123456789';
      let key = 'lt_';
      for (let i = 0; i < 64; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      return key;
    };

    it('should generate API key with correct prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('lt_')).toBe(true);
    });

    it('should generate API key with correct length', () => {
      const key = generateApiKey();
      expect(key.length).toBe(67); // 'lt_' + 64 chars
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('should only contain valid characters', () => {
      const key = generateApiKey();
      const validChars = /^lt_[a-f0-9]+$/;
      expect(validChars.test(key)).toBe(true);
    });
  });

  describe('Session Token Validation', () => {
    const isValidSessionToken = (token: string | undefined): boolean => {
      if (!token) return false;
      if (token.length < 32) return false;
      return true;
    };

    it('should validate valid session tokens', () => {
      const validToken = 'abcdefghijklmnopqrstuvwxyz123456';
      expect(isValidSessionToken(validToken)).toBe(true);
    });

    it('should reject undefined tokens', () => {
      expect(isValidSessionToken(undefined)).toBe(false);
    });

    it('should reject short tokens', () => {
      expect(isValidSessionToken('short')).toBe(false);
    });

    it('should reject empty tokens', () => {
      expect(isValidSessionToken('')).toBe(false);
    });
  });

  describe('User Role Validation', () => {
    type UserRole = 'USER' | 'ADMIN';

    const isValidRole = (role: string): role is UserRole => {
      return role === 'USER' || role === 'ADMIN';
    };

    const hasAdminAccess = (role: string): boolean => {
      return role === 'ADMIN';
    };

    it('should validate valid roles', () => {
      expect(isValidRole('USER')).toBe(true);
      expect(isValidRole('ADMIN')).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(isValidRole('GUEST')).toBe(false);
      expect(isValidRole('admin')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });

    it('should check admin access correctly', () => {
      expect(hasAdminAccess('ADMIN')).toBe(true);
      expect(hasAdminAccess('USER')).toBe(false);
    });
  });

  describe('Registration Input Validation', () => {
    interface RegistrationInput {
      email: string;
      password: string;
      name?: string;
    }

    const validateRegistration = (input: RegistrationInput): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!input.email || !emailRegex.test(input.email)) {
        errors.push('Invalid email format');
      }

      // Password validation
      if (!input.password || input.password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    };

    it('should validate correct registration input', () => {
      const input = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };
      const result = validateRegistration(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid',
        password: 'password123',
      };
      const result = validateRegistration(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject short password', () => {
      const input = {
        email: 'test@example.com',
        password: 'short',
      };
      const result = validateRegistration(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should report multiple errors', () => {
      const input = {
        email: 'invalid',
        password: 'short',
      };
      const result = validateRegistration(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('API Key Prefix Extraction', () => {
    const extractKeyPrefix = (key: string, length: number = 10): string => {
      return key.substring(0, length);
    };

    it('should extract correct prefix', () => {
      const key = 'lt_abcdefghijklmnopqrstuvwxyz';
      expect(extractKeyPrefix(key)).toBe('lt_abcdefg');
    });

    it('should handle short keys', () => {
      const key = 'lt_abc';
      expect(extractKeyPrefix(key)).toBe('lt_abc');
    });

    it('should handle custom prefix length', () => {
      const key = 'lt_abcdefghijklmnopqrstuvwxyz';
      expect(extractKeyPrefix(key, 5)).toBe('lt_ab');
    });
  });

  describe('OAuth Provider Detection', () => {
    const getProviderFromAccount = (provider: string): string => {
      switch (provider) {
        case 'github':
          return 'GitHub';
        case 'google':
          return 'Google';
        case 'credentials':
          return 'Email';
        default:
          return 'Unknown';
      }
    };

    it('should detect GitHub provider', () => {
      expect(getProviderFromAccount('github')).toBe('GitHub');
    });

    it('should detect Google provider', () => {
      expect(getProviderFromAccount('google')).toBe('Google');
    });

    it('should detect credentials provider', () => {
      expect(getProviderFromAccount('credentials')).toBe('Email');
    });

    it('should handle unknown providers', () => {
      expect(getProviderFromAccount('facebook')).toBe('Unknown');
    });
  });
});
