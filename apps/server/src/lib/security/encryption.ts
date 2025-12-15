import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

// Constants
const ALGORITHM = 'aes-256-gcm';
const RSA_KEY_SIZE = 2048;
const KEY_ROTATION_DAYS = 30;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get master key from environment
function getMasterKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    // In production, we require a master key - never use a default
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_MASTER_KEY environment variable is required in production. ' +
          'Generate a secure key with: openssl rand -hex 32'
      );
    }
    // Only use default key in development/test environments
    console.warn(
      'WARNING: Using default encryption key. ' +
        'Set ENCRYPTION_MASTER_KEY env variable for production.'
    );
    return crypto.scryptSync('default-dev-key-not-for-production', 'salt', 32);
  }

  // Validate key format (should be 64 hex characters = 32 bytes)
  if (!/^[a-fA-F0-9]{64}$/.test(masterKey)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: openssl rand -hex 32'
    );
  }

  return Buffer.from(masterKey, 'hex');
}

// Generate RSA key pair
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_KEY_SIZE,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

// Encrypt private key with master key
export function encryptPrivateKey(privateKey: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Decrypt private key with master key
export function decryptPrivateKey(encryptedData: string): string {
  const masterKey = getMasterKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Encrypt data with RSA public key
export function encryptWithPublicKey(data: Buffer, publicKey: string): Buffer {
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data
  );
}

// Decrypt data with RSA private key
export function decryptWithPrivateKey(data: Buffer, privateKey: string): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data
  );
}

// Generate symmetric key for payload encryption
export function generateSymmetricKey(): Buffer {
  return crypto.randomBytes(32); // 256 bits
}

// Encrypt payload with AES-256-GCM
export function encryptPayload(
  data: Buffer,
  key: Buffer
): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

// Decrypt payload with AES-256-GCM
export function decryptPayload(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Derive key from password
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32);
}

// Generate random salt
export function generateSalt(): Buffer {
  return crypto.randomBytes(16);
}

// Tunnel Encryption Service

export interface EncryptionSettings {
  enabled: boolean;
  mode: 'E2E' | 'TRANSPORT' | 'NONE';
  algorithm: string;
  keyRotationDays: number;
  lastRotation: Date | null;
}

export interface EncryptionKeyInfo {
  publicKey: string;
  algorithm: string;
  expiresAt: Date;
  createdAt: Date;
}

// Get or create encryption settings for a tunnel
export async function getOrCreateEncryptionSettings(
  tunnelId: string
): Promise<EncryptionSettings> {
  let settings = await prisma.tunnelEncryption.findUnique({
    where: { tunnelId },
  });

  if (!settings) {
    settings = await prisma.tunnelEncryption.create({
      data: {
        tunnelId,
        enabled: false,
        mode: 'TRANSPORT',
        algorithm: 'AES-256-GCM',
        keyRotationDays: KEY_ROTATION_DAYS,
      },
    });
  }

  return {
    enabled: settings.enabled,
    mode: settings.mode as 'E2E' | 'TRANSPORT' | 'NONE',
    algorithm: settings.algorithm,
    keyRotationDays: settings.keyRotationDays,
    lastRotation: settings.lastRotation,
  };
}

// Update encryption settings
export async function updateEncryptionSettings(
  tunnelId: string,
  settings: Partial<EncryptionSettings>
): Promise<EncryptionSettings> {
  const updated = await prisma.tunnelEncryption.upsert({
    where: { tunnelId },
    create: {
      tunnelId,
      enabled: settings.enabled ?? false,
      mode: settings.mode ?? 'TRANSPORT',
      algorithm: settings.algorithm ?? 'AES-256-GCM',
      keyRotationDays: settings.keyRotationDays ?? KEY_ROTATION_DAYS,
    },
    update: {
      enabled: settings.enabled,
      mode: settings.mode,
      algorithm: settings.algorithm,
      keyRotationDays: settings.keyRotationDays,
    },
  });

  return {
    enabled: updated.enabled,
    mode: updated.mode as 'E2E' | 'TRANSPORT' | 'NONE',
    algorithm: updated.algorithm,
    keyRotationDays: updated.keyRotationDays,
    lastRotation: updated.lastRotation,
  };
}

// Generate and store encryption keys for a tunnel
export async function generateTunnelKeys(tunnelId: string): Promise<EncryptionKeyInfo> {
  const { publicKey, privateKey } = generateKeyPair();
  const encryptedPrivateKey = encryptPrivateKey(privateKey);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + KEY_ROTATION_DAYS);

  const key = await prisma.encryptionKey.upsert({
    where: { tunnelId },
    create: {
      tunnelId,
      publicKey,
      privateKey: encryptedPrivateKey,
      algorithm: 'RSA-2048',
      expiresAt,
    },
    update: {
      publicKey,
      privateKey: encryptedPrivateKey,
      expiresAt,
      rotatedAt: new Date(),
    },
  });

  // Update last rotation time
  await prisma.tunnelEncryption.update({
    where: { tunnelId },
    data: { lastRotation: new Date() },
  });

  return {
    publicKey: key.publicKey,
    algorithm: key.algorithm,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
  };
}

// Get public key for a tunnel
export async function getTunnelPublicKey(tunnelId: string): Promise<EncryptionKeyInfo | null> {
  const key = await prisma.encryptionKey.findUnique({
    where: { tunnelId },
  });

  if (!key) {
    return null;
  }

  return {
    publicKey: key.publicKey,
    algorithm: key.algorithm,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
  };
}

// Rotate tunnel keys if expired
export async function rotateKeysIfNeeded(tunnelId: string): Promise<boolean> {
  const key = await prisma.encryptionKey.findUnique({
    where: { tunnelId },
  });

  if (!key) {
    return false;
  }

  const now = new Date();
  if (key.expiresAt > now) {
    return false; // Key not expired
  }

  await generateTunnelKeys(tunnelId);
  return true;
}

// Delete tunnel encryption data
export async function deleteTunnelEncryption(tunnelId: string): Promise<void> {
  await prisma.encryptionKey.deleteMany({
    where: { tunnelId },
  });

  await prisma.tunnelEncryption.deleteMany({
    where: { tunnelId },
  });
}

// Check if encryption is enabled for a tunnel
export async function isEncryptionEnabled(tunnelId: string): Promise<boolean> {
  const settings = await prisma.tunnelEncryption.findUnique({
    where: { tunnelId },
  });

  return settings?.enabled ?? false;
}

// Get decrypted private key for a tunnel
export async function getTunnelPrivateKey(tunnelId: string): Promise<string | null> {
  const key = await prisma.encryptionKey.findUnique({
    where: { tunnelId },
  });

  if (!key) {
    return null;
  }

  return decryptPrivateKey(key.privateKey);
}

// Encrypt request payload
export async function encryptRequest(
  tunnelId: string,
  payload: Buffer
): Promise<{ encrypted: string; sessionKey: string } | null> {
  const keyInfo = await getTunnelPublicKey(tunnelId);
  if (!keyInfo) {
    return null;
  }

  // Generate session key
  const sessionKey = generateSymmetricKey();

  // Encrypt payload with session key
  const { encrypted, iv, authTag } = encryptPayload(payload, sessionKey);

  // Encrypt session key with RSA public key
  const encryptedSessionKey = encryptWithPublicKey(sessionKey, keyInfo.publicKey);

  // Combine everything: iv:authTag:encrypted
  const encryptedPayload = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

  return {
    encrypted: encryptedPayload,
    sessionKey: encryptedSessionKey.toString('base64'),
  };
}

// Decrypt request payload
export async function decryptRequest(
  tunnelId: string,
  encryptedPayload: string,
  encryptedSessionKey: string
): Promise<Buffer | null> {
  const privateKey = await getTunnelPrivateKey(tunnelId);
  if (!privateKey) {
    return null;
  }

  // Decrypt session key
  const sessionKey = decryptWithPrivateKey(
    Buffer.from(encryptedSessionKey, 'base64'),
    privateKey
  );

  // Parse encrypted payload
  const [ivBase64, authTagBase64, encryptedBase64] = encryptedPayload.split(':');
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  // Decrypt payload
  return decryptPayload(encrypted, sessionKey, iv, authTag);
}
