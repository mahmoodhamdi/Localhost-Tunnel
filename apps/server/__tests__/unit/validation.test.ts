import { describe, it, expect } from 'vitest';
import {
  VALIDATION_LIMITS,
  validateEmail,
  validatePort,
  validateStringLength,
  sanitizeString,
  validateRequiredString,
  validateOptionalString,
  validateEmailInput,
  validatePasswordInput,
  validatePortInput,
  validateExpiresIn,
  validateBoolean,
  validateUUID,
  validateUUIDInput,
  getContentLength,
  checkBodySizeLimit,
} from '../../src/lib/api/validation';
import { ApiException } from '../../src/lib/api/withApiHandler';

describe('Validation Utilities', () => {
  describe('VALIDATION_LIMITS', () => {
    it('should have correct default values', () => {
      expect(VALIDATION_LIMITS.MAX_NAME_LENGTH).toBe(100);
      expect(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH).toBe(500);
      expect(VALIDATION_LIMITS.MAX_EMAIL_LENGTH).toBe(255);
      expect(VALIDATION_LIMITS.MAX_PASSWORD_LENGTH).toBe(128);
      expect(VALIDATION_LIMITS.MAX_SUBDOMAIN_LENGTH).toBe(63);
      expect(VALIDATION_LIMITS.MIN_PORT).toBe(1);
      expect(VALIDATION_LIMITS.MAX_PORT).toBe(65535);
      expect(VALIDATION_LIMITS.MIN_PASSWORD_LENGTH).toBe(8);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.org')).toBe(true);
      expect(validateEmail('user+tag@sub.domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('no@domain')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user @domain.com')).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should validate valid ports', () => {
      expect(validatePort(1)).toBe(true);
      expect(validatePort(80)).toBe(true);
      expect(validatePort(443)).toBe(true);
      expect(validatePort(3000)).toBe(true);
      expect(validatePort(65535)).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(validatePort(0)).toBe(false);
      expect(validatePort(-1)).toBe(false);
      expect(validatePort(65536)).toBe(false);
      expect(validatePort(1.5)).toBe(false);
      expect(validatePort(NaN)).toBe(false);
    });
  });

  describe('validateStringLength', () => {
    it('should validate string within limits', () => {
      expect(validateStringLength('hello', 10)).toBe(true);
      expect(validateStringLength('hello', 5)).toBe(true);
      expect(validateStringLength('', 10)).toBe(true);
    });

    it('should reject strings exceeding max length', () => {
      expect(validateStringLength('hello world', 5)).toBe(false);
    });

    it('should handle min length', () => {
      expect(validateStringLength('hi', 10, 3)).toBe(false);
      expect(validateStringLength('hello', 10, 3)).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(validateStringLength(null, 10)).toBe(true);
      expect(validateStringLength(undefined, 10)).toBe(true);
      expect(validateStringLength(null, 10, 1)).toBe(false);
      expect(validateStringLength(undefined, 10, 1)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\thello\t')).toBe('hello');
    });

    it('should preserve newlines', () => {
      expect(sanitizeString('hello\nworld')).toBe('hello\nworld');
    });

    it('should remove control characters', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('test\x1Fdata')).toBe('testdata');
    });
  });

  describe('validateRequiredString', () => {
    it('should validate and return trimmed string', () => {
      expect(validateRequiredString('  hello  ', 'name')).toBe('hello');
    });

    it('should throw for empty string', () => {
      expect(() => validateRequiredString('', 'name')).toThrow(ApiException);
      expect(() => validateRequiredString('   ', 'name')).toThrow(ApiException);
    });

    it('should throw for non-string values', () => {
      expect(() => validateRequiredString(null, 'name')).toThrow(ApiException);
      expect(() => validateRequiredString(undefined, 'name')).toThrow(ApiException);
      expect(() => validateRequiredString(123, 'name')).toThrow(ApiException);
    });

    it('should throw for strings exceeding max length', () => {
      const longString = 'a'.repeat(101);
      expect(() => validateRequiredString(longString, 'name')).toThrow(ApiException);
    });

    it('should use custom max length', () => {
      expect(validateRequiredString('hello', 'name', 5)).toBe('hello');
      expect(() => validateRequiredString('hello', 'name', 4)).toThrow(ApiException);
    });
  });

  describe('validateOptionalString', () => {
    it('should return null for empty values', () => {
      expect(validateOptionalString(null, 'name')).toBeNull();
      expect(validateOptionalString(undefined, 'name')).toBeNull();
      expect(validateOptionalString('', 'name')).toBeNull();
    });

    it('should validate and return trimmed string', () => {
      expect(validateOptionalString('  hello  ', 'name')).toBe('hello');
    });

    it('should return null for whitespace-only string', () => {
      expect(validateOptionalString('   ', 'name')).toBeNull();
    });

    it('should throw for non-string values', () => {
      expect(() => validateOptionalString(123, 'name')).toThrow(ApiException);
      expect(() => validateOptionalString({}, 'name')).toThrow(ApiException);
    });

    it('should throw for strings exceeding max length', () => {
      const longString = 'a'.repeat(101);
      expect(() => validateOptionalString(longString, 'name')).toThrow(ApiException);
    });
  });

  describe('validateEmailInput', () => {
    it('should validate and normalize email', () => {
      expect(validateEmailInput('Test@Example.COM')).toBe('test@example.com');
      expect(validateEmailInput('  user@domain.org  ')).toBe('user@domain.org');
    });

    it('should throw for non-string values', () => {
      expect(() => validateEmailInput(null)).toThrow(ApiException);
      expect(() => validateEmailInput(123)).toThrow(ApiException);
    });

    it('should throw for invalid email format', () => {
      expect(() => validateEmailInput('invalid')).toThrow(ApiException);
      expect(() => validateEmailInput('no@domain')).toThrow(ApiException);
    });

    it('should throw for email exceeding max length', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => validateEmailInput(longEmail)).toThrow(ApiException);
    });
  });

  describe('validatePasswordInput', () => {
    it('should validate valid passwords', () => {
      expect(validatePasswordInput('Password1!')).toBe('Password1!');
      expect(validatePasswordInput('Abcdef1@')).toBe('Abcdef1@');
    });

    it('should throw for weak passwords (missing complexity)', () => {
      expect(() => validatePasswordInput('password123')).toThrow(ApiException);
      expect(() => validatePasswordInput('12345678')).toThrow(ApiException);
      expect(() => validatePasswordInput('abcdefgh')).toThrow(ApiException);
    });

    it('should throw for non-string values', () => {
      expect(() => validatePasswordInput(null)).toThrow(ApiException);
      expect(() => validatePasswordInput(123)).toThrow(ApiException);
    });

    it('should throw for password too short', () => {
      expect(() => validatePasswordInput('short')).toThrow(ApiException);
      expect(() => validatePasswordInput('1234567')).toThrow(ApiException);
    });

    it('should throw for password too long', () => {
      const longPassword = 'Aa1!' + 'a'.repeat(125);
      expect(() => validatePasswordInput(longPassword)).toThrow(ApiException);
    });

    it('should use custom field name in error', () => {
      try {
        validatePasswordInput('short', 'PIN');
      } catch (err) {
        expect((err as ApiException).message).toContain('PIN');
      }
    });
  });

  describe('validatePortInput', () => {
    it('should validate numeric port', () => {
      expect(validatePortInput(80)).toBe(80);
      expect(validatePortInput(3000)).toBe(3000);
    });

    it('should parse string port', () => {
      expect(validatePortInput('8080')).toBe(8080);
      expect(validatePortInput('443')).toBe(443);
    });

    it('should throw for invalid ports', () => {
      expect(() => validatePortInput(0)).toThrow(ApiException);
      expect(() => validatePortInput(65536)).toThrow(ApiException);
      expect(() => validatePortInput('invalid')).toThrow(ApiException);
      expect(() => validatePortInput(null)).toThrow(ApiException);
    });
  });

  describe('validateExpiresIn', () => {
    it('should return null for null/undefined', () => {
      expect(validateExpiresIn(null)).toBeNull();
      expect(validateExpiresIn(undefined)).toBeNull();
    });

    it('should validate numeric value', () => {
      expect(validateExpiresIn(3600)).toBe(3600);
      expect(validateExpiresIn(86400)).toBe(86400);
    });

    it('should parse string value', () => {
      expect(validateExpiresIn('3600')).toBe(3600);
    });

    it('should throw for non-positive values', () => {
      expect(() => validateExpiresIn(0)).toThrow(ApiException);
      expect(() => validateExpiresIn(-1)).toThrow(ApiException);
    });

    it('should throw for values exceeding 1 year', () => {
      const oneYearPlusOne = 365 * 24 * 60 * 60 + 1;
      expect(() => validateExpiresIn(oneYearPlusOne)).toThrow(ApiException);
    });
  });

  describe('validateBoolean', () => {
    it('should return default for null/undefined', () => {
      expect(validateBoolean(null, true)).toBe(true);
      expect(validateBoolean(undefined, false)).toBe(false);
    });

    it('should return boolean values as-is', () => {
      expect(validateBoolean(true, false)).toBe(true);
      expect(validateBoolean(false, true)).toBe(false);
    });

    it('should parse string "true" and "1"', () => {
      expect(validateBoolean('true', false)).toBe(true);
      expect(validateBoolean('TRUE', false)).toBe(true);
      expect(validateBoolean('1', false)).toBe(true);
    });

    it('should return default for other string values', () => {
      expect(validateBoolean('false', true)).toBe(false);
      expect(validateBoolean('0', true)).toBe(false);
      expect(validateBoolean('other', true)).toBe(false);
    });

    it('should return default for non-string/boolean values', () => {
      expect(validateBoolean(123, true)).toBe(true);
      expect(validateBoolean({}, false)).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validateUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(validateUUID('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(validateUUID('')).toBe(false);
      expect(validateUUID('not-a-uuid')).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(validateUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });

  describe('validateUUIDInput', () => {
    it('should validate and return UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(validateUUIDInput(uuid)).toBe(uuid);
    });

    it('should throw for invalid UUID', () => {
      expect(() => validateUUIDInput('invalid')).toThrow(ApiException);
      expect(() => validateUUIDInput(123)).toThrow(ApiException);
    });

    it('should use custom field name', () => {
      try {
        validateUUIDInput('invalid', 'tunnelId');
      } catch (err) {
        expect((err as ApiException).message).toContain('tunnelId');
      }
    });
  });

  describe('getContentLength', () => {
    it('should return content length from headers', () => {
      const request = {
        headers: new Headers({ 'content-length': '1024' }),
      } as unknown as Request;
      expect(getContentLength(request)).toBe(1024);
    });

    it('should return null when header is missing', () => {
      const request = {
        headers: new Headers(),
      } as unknown as Request;
      expect(getContentLength(request)).toBeNull();
    });
  });

  describe('checkBodySizeLimit', () => {
    it('should not throw for body within limit', () => {
      const request = {
        headers: new Headers({ 'content-length': '1024' }),
      } as unknown as Request;
      expect(() => checkBodySizeLimit(request, 2048)).not.toThrow();
    });

    it('should not throw when content-length is missing', () => {
      const request = {
        headers: new Headers(),
      } as unknown as Request;
      expect(() => checkBodySizeLimit(request, 1024)).not.toThrow();
    });

    it('should throw for body exceeding limit', () => {
      const request = {
        headers: new Headers({ 'content-length': '2048' }),
      } as unknown as Request;
      expect(() => checkBodySizeLimit(request, 1024)).toThrow(ApiException);
    });

    it('should use default limit', () => {
      const request = {
        headers: new Headers({ 'content-length': String(2 * 1024 * 1024) }),
      } as unknown as Request;
      expect(() => checkBodySizeLimit(request)).toThrow(ApiException);
    });
  });
});
