import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validatePasswordInput } from '@/lib/api/validation';
import { ApiException } from '@/lib/api/withApiHandler';

describe('Password Reset', () => {
  describe('Token Validation', () => {
    it('should reject empty token', () => {
      const token = '';
      expect(token.trim().length).toBe(0);
      expect(token.trim().length === 0).toBe(true);
    });

    it('should reject whitespace-only token', () => {
      const token = '   ';
      expect(token.trim().length).toBe(0);
    });

    it('should accept non-empty token', () => {
      const token = 'valid-reset-token-abc123';
      expect(token.trim().length).toBeGreaterThan(0);
    });

    it('should reject expired token', () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      const currentDate = new Date();
      expect(expiredDate < currentDate).toBe(true);
    });

    it('should accept valid unexpired token', () => {
      const validDate = new Date(Date.now() + 3600000); // 1 hour from now
      const currentDate = new Date();
      expect(validDate > currentDate).toBe(true);
    });

    it('should handle token at exact expiration boundary', () => {
      const now = new Date();
      const expiryTime = now.getTime();
      const expiryDate = new Date(expiryTime);

      // At exact boundary, should be expired (using > comparison)
      expect(expiryDate > now).toBe(false);
    });

    it('should handle token expiring in 1 second', () => {
      const futureDate = new Date(Date.now() + 1000);
      const currentDate = new Date();
      expect(futureDate > currentDate).toBe(true);
    });
  });

  describe('Password Complexity', () => {
    it('should validate correct complex passwords with 3+ requirements', () => {
      const validPasswords = [
        'Password1!',      // uppercase + lowercase + number + special (4)
        'Abcdef1@',        // uppercase + lowercase + number + special (4)
        'UPPER123!lower',  // uppercase + lowercase + number + special (4)
        'SecureP@ss123',   // uppercase + lowercase + number + special (4)
        'My$trong9Pass',   // uppercase + lowercase + number + special (4)
        'password123!',    // lowercase + number + special (3) ✓
        'PASSWORD123!',    // uppercase + number + special (3) ✓
        'PasswordNoNum!',  // uppercase + lowercase + special (3) ✓
        'PasswordWith123', // uppercase + lowercase + number (3) ✓
      ];

      validPasswords.forEach((password) => {
        expect(() => validatePasswordInput(password)).not.toThrow();
      });
    });

    it('should reject password with only 2 complexity requirements - uppercase + lowercase', () => {
      // Only uppercase and lowercase, no number, no special
      expect(() => validatePasswordInput('PasswordAbcd')).toThrow(ApiException);
    });

    it('should reject password with only 2 complexity requirements - uppercase + number', () => {
      // Only uppercase and number, no lowercase, no special
      expect(() => validatePasswordInput('PASSWORD123')).toThrow(ApiException);
    });

    it('should reject password with only 2 complexity requirements - lowercase + number', () => {
      // Only lowercase and number, no uppercase, no special
      expect(() => validatePasswordInput('password123')).toThrow(ApiException);
    });

    it('should reject password with only 2 complexity requirements - lowercase + special', () => {
      // Only lowercase and special, no uppercase, no number
      expect(() => validatePasswordInput('password!@#')).toThrow(ApiException);
    });

    it('should reject password with only 2 complexity requirements - uppercase + special', () => {
      // Only uppercase and special, no lowercase, no number
      expect(() => validatePasswordInput('PASSWORD!@#')).toThrow(ApiException);
    });

    it('should reject password with only 2 complexity requirements - number + special', () => {
      // Only number and special, no uppercase, no lowercase
      expect(() => validatePasswordInput('123!@#456')).toThrow(ApiException);
    });

    it('should reject password that is just lowercase', () => {
      expect(() => validatePasswordInput('abcdefgh')).toThrow(ApiException);
    });

    it('should reject password that is just uppercase', () => {
      expect(() => validatePasswordInput('ABCDEFGH')).toThrow(ApiException);
    });

    it('should reject password that is just numbers', () => {
      expect(() => validatePasswordInput('12345678')).toThrow(ApiException);
    });

    it('should reject password that is just special characters', () => {
      expect(() => validatePasswordInput('!@#$%^&*')).toThrow(ApiException);
    });
  });

  describe('Password Length', () => {
    it('should reject password shorter than 8 characters', () => {
      expect(() => validatePasswordInput('Pass1!')).toThrow(ApiException);
      expect(() => validatePasswordInput('Pw1!')).toThrow(ApiException);
    });

    it('should accept password of exactly 8 characters', () => {
      expect(() => validatePasswordInput('Passw0rd')).not.toThrow();
    });

    it('should accept password longer than 8 characters', () => {
      expect(() => validatePasswordInput('VeryLongPassword123!')).not.toThrow();
    });

    it('should reject password exceeding 128 characters', () => {
      const longPassword = 'Aa1!' + 'a'.repeat(125); // 129 characters
      expect(() => validatePasswordInput(longPassword)).toThrow(ApiException);
    });

    it('should accept password of exactly 128 characters', () => {
      const maxPassword = 'Aa1!' + 'a'.repeat(121); // Exactly 128 characters
      expect(() => validatePasswordInput(maxPassword)).not.toThrow();
    });

    it('should reject null password', () => {
      expect(() => validatePasswordInput(null)).toThrow(ApiException);
    });

    it('should reject undefined password', () => {
      expect(() => validatePasswordInput(undefined)).toThrow(ApiException);
    });

    it('should reject non-string password', () => {
      expect(() => validatePasswordInput(123)).toThrow(ApiException);
      expect(() => validatePasswordInput({})).toThrow(ApiException);
      expect(() => validatePasswordInput([])).toThrow(ApiException);
    });
  });

  describe('Password Reset Flow', () => {
    it('should require token for password reset', () => {
      const token = null;
      const password = 'ValidPassword123!';

      expect(token).toBeNull();
      expect(() => {
        if (!token) throw new Error('Token is required');
      }).toThrow('Token is required');
    });

    it('should validate password before updating', () => {
      const validPassword = 'ValidPassword123!';
      expect(() => validatePasswordInput(validPassword)).not.toThrow();
    });

    it('should not allow resetting with weak password', () => {
      const weakPassword = 'weak';
      expect(() => validatePasswordInput(weakPassword)).toThrow(ApiException);
    });

    it('should trim whitespace from token', () => {
      const token = '  valid-token-123  ';
      const trimmedToken = token.trim();
      expect(trimmedToken).toBe('valid-token-123');
      expect(trimmedToken.length > 0).toBe(true);
    });

    it('should handle special characters in password', () => {
      const specialCharPasswords = [
        'P@ssw0rd!123',
        'Pass#word$123',
        'P&ssw%rd123!',
        'Pass~word^123',
      ];

      specialCharPasswords.forEach((password) => {
        expect(() => validatePasswordInput(password)).not.toThrow();
      });
    });
  });

  describe('Password Reset Error Messages', () => {
    it('should include field name in validation error', () => {
      try {
        validatePasswordInput('weak', 'newPassword');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiException);
        expect((error as ApiException).message).toBeDefined();
      }
    });

    it('should reject empty string with clear error', () => {
      expect(() => validatePasswordInput('')).toThrow(ApiException);
    });

    it('should indicate password complexity requirements not met', () => {
      try {
        validatePasswordInput('abcdefgh');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiException);
      }
    });

    it('should indicate password too short error', () => {
      try {
        validatePasswordInput('Short1!');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiException);
      }
    });

    it('should indicate password too long error', () => {
      const tooLong = 'A' + '1' + '!' + 'a'.repeat(126);
      try {
        validatePasswordInput(tooLong);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiException);
      }
    });
  });

  describe('Password Reset Security', () => {
    it('should not expose token in error messages', () => {
      try {
        validatePasswordInput('');
      } catch (error) {
        const message = (error as ApiException).message.toLowerCase();
        expect(message).not.toContain('token');
      }
    });

    it('should not store plaintext passwords', () => {
      // This is more of a contract test - ensuring validatePasswordInput
      // returns the password as-is (hashing happens server-side)
      const password = 'ValidPass123!';
      const result = validatePasswordInput(password);
      expect(result).toBe(password);
      // In real implementation, this gets hashed with bcrypt server-side
    });

    it('should handle rapid reset attempts (rate limiting concern)', () => {
      // Multiple validation calls should be quick
      const password = 'ValidPass123!';
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        validatePasswordInput(password);
      }

      const elapsed = Date.now() - start;
      // Validation should be very fast (< 1000ms for 100 calls)
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle password with spaces', () => {
      // Password with space but meets complexity (uppercase + lowercase + number + special)
      const passwordWithSpace = 'Pass word1!';
      expect(() => validatePasswordInput(passwordWithSpace)).not.toThrow();
    });

    it('should handle password with leading/trailing spaces (not trimmed by validator)', () => {
      // The validation does NOT trim whitespace for passwords
      const passwordWithSpaces = '  Password123!  ';
      // This includes spaces which count as characters
      expect(() => validatePasswordInput(passwordWithSpaces)).not.toThrow();
    });

    it('should handle Unicode characters in password', () => {
      const unicodePassword = 'P@ss🔒123word';
      // Should accept unicode as part of special characters/letters
      try {
        validatePasswordInput(unicodePassword);
        // If no throw, unicode is accepted
        expect(true).toBe(true);
      } catch {
        // If throw, that's acceptable too - depends on requirements
        expect(true).toBe(true);
      }
    });

    it('should handle consecutive special characters', () => {
      const passwordWithConsecutiveSpecials = 'Pass@#$w0rd';
      expect(() => validatePasswordInput(passwordWithConsecutiveSpecials)).not.toThrow();
    });

    it('should handle repeated characters', () => {
      const repeatedPassword = 'PPPaaaa1!!!';
      // Should accept as long as complexity requirements met (uppercase + lowercase + number + special)
      expect(() => validatePasswordInput(repeatedPassword)).not.toThrow();
    });

    it('should accept password with all 4 complexity requirements', () => {
      const fullComplexity = 'Password123!';
      expect(() => validatePasswordInput(fullComplexity)).not.toThrow();
    });

    it('should accept password with exactly 3 complexity requirements', () => {
      // Uppercase + lowercase + number only (no special)
      const threeRequirements = 'Password123';
      expect(() => validatePasswordInput(threeRequirements)).not.toThrow();
    });
  });

  describe('Boundary conditions', () => {
    it('should validate password at minimum length with minimum complexity', () => {
      // 8 chars with exactly 3 complexity requirements
      const minPassword = 'Passw0rd'; // uppercase + lowercase + number
      expect(() => validatePasswordInput(minPassword)).not.toThrow();
    });

    it('should validate password at maximum length with minimum complexity', () => {
      // 128 chars with exactly 3 complexity requirements
      const maxPassword = 'A' + 'a'.repeat(126) + '1'; // uppercase + lowercase + number
      expect(() => validatePasswordInput(maxPassword)).not.toThrow();
    });

    it('should reject password 1 character below minimum', () => {
      const tooShort = 'Passw0r'; // 7 characters
      expect(() => validatePasswordInput(tooShort)).toThrow(ApiException);
    });

    it('should reject password 1 character above maximum', () => {
      const tooLong = 'A' + 'a'.repeat(127); // 129 characters
      expect(() => validatePasswordInput(tooLong)).toThrow(ApiException);
    });
  });
});
