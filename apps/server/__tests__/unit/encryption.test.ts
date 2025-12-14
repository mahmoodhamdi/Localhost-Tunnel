import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('Encryption - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RSA Key Pair Generation
  describe('RSA Key Pair Generation', () => {
    it('should generate valid RSA key pair', () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    it('should generate different keys each time', () => {
      const pair1 = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const pair2 = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      expect(pair1.publicKey).not.toBe(pair2.publicKey);
      expect(pair1.privateKey).not.toBe(pair2.privateKey);
    });
  });

  // AES-256-GCM Encryption
  describe('AES-256-GCM Encryption', () => {
    const algorithm = 'aes-256-gcm';

    function encrypt(
      data: Buffer,
      key: Buffer
    ): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return { encrypted, iv, authTag };
    }

    function decrypt(
      encrypted: Buffer,
      key: Buffer,
      iv: Buffer,
      authTag: Buffer
    ): Buffer {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }

    it('should encrypt and decrypt data correctly', () => {
      const key = crypto.randomBytes(32);
      const plaintext = Buffer.from('Hello, World!');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key, iv, authTag);

      expect(decrypted.toString()).toBe('Hello, World!');
    });

    it('should produce different ciphertext with different IVs', () => {
      const key = crypto.randomBytes(32);
      const plaintext = Buffer.from('Same message');

      const result1 = encrypt(plaintext, key);
      const result2 = encrypt(plaintext, key);

      expect(result1.encrypted.toString('hex')).not.toBe(result2.encrypted.toString('hex'));
    });

    it('should fail decryption with wrong key', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const plaintext = Buffer.from('Secret data');

      const { encrypted, iv, authTag } = encrypt(plaintext, key1);

      expect(() => decrypt(encrypted, key2, iv, authTag)).toThrow();
    });

    it('should fail decryption with tampered auth tag', () => {
      const key = crypto.randomBytes(32);
      const plaintext = Buffer.from('Secret data');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      authTag[0] = authTag[0] ^ 0xff; // Tamper with auth tag

      expect(() => decrypt(encrypted, key, iv, authTag)).toThrow();
    });

    it('should handle empty data', () => {
      const key = crypto.randomBytes(32);
      const plaintext = Buffer.from('');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key, iv, authTag);

      expect(decrypted.toString()).toBe('');
    });

    it('should handle large data', () => {
      const key = crypto.randomBytes(32);
      const plaintext = Buffer.alloc(1024 * 1024, 'a'); // 1MB of data

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key, iv, authTag);

      expect(decrypted.length).toBe(plaintext.length);
      expect(decrypted.toString()).toBe(plaintext.toString());
    });
  });

  // RSA Encryption/Decryption
  describe('RSA Encryption/Decryption', () => {
    it('should encrypt and decrypt with RSA-OAEP', () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const data = Buffer.from('Session key');

      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        data
      );

      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encrypted
      );

      expect(decrypted.toString()).toBe('Session key');
    });

    it('should produce different ciphertext each time', () => {
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const data = Buffer.from('Same data');

      const encrypted1 = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        data
      );

      const encrypted2 = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        data
      );

      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
    });
  });

  // Key Derivation
  describe('Key Derivation', () => {
    it('should derive consistent key from password', () => {
      const password = 'mypassword';
      const salt = Buffer.from('mysalt123456789');

      const key1 = crypto.scryptSync(password, salt, 32);
      const key2 = crypto.scryptSync(password, salt, 32);

      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('should derive different keys with different salts', () => {
      const password = 'mypassword';
      const salt1 = crypto.randomBytes(16);
      const salt2 = crypto.randomBytes(16);

      const key1 = crypto.scryptSync(password, salt1, 32);
      const key2 = crypto.scryptSync(password, salt2, 32);

      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should derive 32-byte key for AES-256', () => {
      const password = 'mypassword';
      const salt = crypto.randomBytes(16);

      const key = crypto.scryptSync(password, salt, 32);

      expect(key.length).toBe(32);
    });
  });

  // Master Key Encryption
  describe('Master Key Encryption', () => {
    function encryptWithMasterKey(data: string, masterKey: Buffer): string {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    function decryptWithMasterKey(encryptedData: string, masterKey: Buffer): string {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    it('should encrypt and decrypt private key', () => {
      const masterKey = crypto.scryptSync('master-key', 'salt', 32);
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----';

      const encrypted = encryptWithMasterKey(privateKey, masterKey);
      const decrypted = decryptWithMasterKey(encrypted, masterKey);

      expect(decrypted).toBe(privateKey);
    });

    it('should produce valid format', () => {
      const masterKey = crypto.scryptSync('master-key', 'salt', 32);
      const data = 'test data';

      const encrypted = encryptWithMasterKey(data, masterKey);
      const parts = encrypted.split(':');

      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(32); // IV is 16 bytes = 32 hex chars
      expect(parts[1].length).toBe(32); // Auth tag is 16 bytes = 32 hex chars
    });
  });

  // Encryption Settings Validation
  describe('Encryption Settings Validation', () => {
    interface EncryptionSettings {
      enabled?: boolean;
      mode?: string;
      keyRotationDays?: number;
    }

    function validateSettings(settings: EncryptionSettings): { valid: boolean; error?: string } {
      if (settings.mode && !['E2E', 'TRANSPORT', 'NONE'].includes(settings.mode)) {
        return { valid: false, error: 'Mode must be E2E, TRANSPORT, or NONE' };
      }

      if (settings.keyRotationDays !== undefined) {
        if (settings.keyRotationDays < 1 || settings.keyRotationDays > 365) {
          return { valid: false, error: 'Key rotation days must be between 1 and 365' };
        }
      }

      return { valid: true };
    }

    it('should accept valid settings', () => {
      const result = validateSettings({
        enabled: true,
        mode: 'E2E',
        keyRotationDays: 30,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept all valid modes', () => {
      expect(validateSettings({ mode: 'E2E' }).valid).toBe(true);
      expect(validateSettings({ mode: 'TRANSPORT' }).valid).toBe(true);
      expect(validateSettings({ mode: 'NONE' }).valid).toBe(true);
    });

    it('should reject invalid mode', () => {
      const result = validateSettings({ mode: 'INVALID' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Mode must be E2E, TRANSPORT, or NONE');
    });

    it('should reject key rotation days below 1', () => {
      const result = validateSettings({ keyRotationDays: 0 });
      expect(result.valid).toBe(false);
    });

    it('should reject key rotation days above 365', () => {
      const result = validateSettings({ keyRotationDays: 400 });
      expect(result.valid).toBe(false);
    });

    it('should accept boundary values', () => {
      expect(validateSettings({ keyRotationDays: 1 }).valid).toBe(true);
      expect(validateSettings({ keyRotationDays: 365 }).valid).toBe(true);
    });
  });

  // Key Expiry Calculation
  describe('Key Expiry Calculation', () => {
    function calculateExpiry(rotationDays: number): Date {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rotationDays);
      return expiresAt;
    }

    function isKeyExpired(expiresAt: Date): boolean {
      return new Date() > expiresAt;
    }

    it('should calculate expiry correctly', () => {
      const expiry = calculateExpiry(30);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should detect expired key', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(isKeyExpired(pastDate)).toBe(true);
    });

    it('should detect valid key', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      expect(isKeyExpired(futureDate)).toBe(false);
    });
  });

  // Session Key Exchange
  describe('Session Key Exchange', () => {
    it('should perform hybrid encryption', () => {
      // Generate RSA key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Generate session key
      const sessionKey = crypto.randomBytes(32);

      // Encrypt session key with RSA
      const encryptedSessionKey = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        sessionKey
      );

      // Encrypt payload with session key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
      const payload = Buffer.from('Secret message');
      const encryptedPayload = Buffer.concat([cipher.update(payload), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // --- Decryption side ---

      // Decrypt session key
      const decryptedSessionKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedSessionKey
      );

      // Decrypt payload
      const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedSessionKey, iv);
      decipher.setAuthTag(authTag);
      const decryptedPayload = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);

      expect(decryptedPayload.toString()).toBe('Secret message');
    });
  });

  // Base64 Encoding/Decoding
  describe('Base64 Encoding/Decoding', () => {
    it('should encode and decode binary data', () => {
      const binary = crypto.randomBytes(256);
      const encoded = binary.toString('base64');
      const decoded = Buffer.from(encoded, 'base64');

      expect(decoded.equals(binary)).toBe(true);
    });

    it('should handle encrypted data format', () => {
      const iv = crypto.randomBytes(16);
      const authTag = crypto.randomBytes(16);
      const encrypted = crypto.randomBytes(64);

      const formatted = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

      const [ivPart, authPart, encPart] = formatted.split(':');
      const parsedIv = Buffer.from(ivPart, 'base64');
      const parsedAuth = Buffer.from(authPart, 'base64');
      const parsedEnc = Buffer.from(encPart, 'base64');

      expect(parsedIv.equals(iv)).toBe(true);
      expect(parsedAuth.equals(authTag)).toBe(true);
      expect(parsedEnc.equals(encrypted)).toBe(true);
    });
  });

  // Random Generation
  describe('Random Generation', () => {
    it('should generate cryptographically random bytes', () => {
      const bytes1 = crypto.randomBytes(32);
      const bytes2 = crypto.randomBytes(32);

      expect(bytes1.equals(bytes2)).toBe(false);
    });

    it('should generate correct length', () => {
      expect(crypto.randomBytes(16).length).toBe(16);
      expect(crypto.randomBytes(32).length).toBe(32);
      expect(crypto.randomBytes(64).length).toBe(64);
    });
  });
});
