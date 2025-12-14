# Request/Response Encryption Feature Plan

## Overview
Implement end-to-end encryption for tunnel traffic to ensure data privacy and security between clients and the tunnel server.

## Features

### 1. Encryption Key Management
- Generate unique encryption keys per tunnel
- Store encrypted keys securely in database
- Support key rotation
- Key expiration and automatic regeneration

### 2. Encryption Modes
- **E2E Encryption**: Full end-to-end encryption (client to client)
- **Transport Encryption**: Tunnel transport layer encryption
- **None**: No additional encryption (relies on HTTPS only)

### 3. Encryption Algorithms
- AES-256-GCM for symmetric encryption
- RSA-2048 for key exchange
- HMAC-SHA256 for integrity verification

### 4. Tunnel Encryption Settings
- Enable/disable encryption per tunnel
- Choose encryption mode
- Configure key rotation interval
- View encryption status and metrics

## Database Schema

```prisma
model EncryptionKey {
  id            String    @id @default(cuid())
  publicKey     String    @db.Text
  privateKey    String    @db.Text  // Encrypted with master key
  algorithm     String    @default("RSA-2048")
  expiresAt     DateTime
  rotatedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tunnelId      String    @unique
  tunnel        Tunnel    @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  @@index([tunnelId])
  @@index([expiresAt])
}

model TunnelEncryption {
  id              String    @id @default(cuid())
  enabled         Boolean   @default(false)
  mode            String    @default("TRANSPORT")  // E2E, TRANSPORT, NONE
  algorithm       String    @default("AES-256-GCM")
  keyRotationDays Int       @default(30)
  lastRotation    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tunnelId        String    @unique
  tunnel          Tunnel    @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  @@index([tunnelId])
}
```

## API Endpoints

### Encryption Settings
- `GET /api/tunnels/[id]/encryption` - Get encryption settings
- `PUT /api/tunnels/[id]/encryption` - Update encryption settings
- `POST /api/tunnels/[id]/encryption/rotate` - Rotate encryption keys

### Key Management
- `GET /api/tunnels/[id]/encryption/key` - Get public key
- `POST /api/tunnels/[id]/encryption/key/generate` - Generate new key pair

## Encryption Service

```typescript
// lib/security/encryption.ts

interface EncryptionService {
  // Key management
  generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>;
  rotateKeys(tunnelId: string): Promise<void>;

  // Encryption/Decryption
  encrypt(data: Buffer, publicKey: string): Promise<Buffer>;
  decrypt(data: Buffer, privateKey: string): Promise<Buffer>;

  // Symmetric encryption for payload
  encryptPayload(data: Buffer, key: Buffer): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer }>;
  decryptPayload(encrypted: Buffer, key: Buffer, iv: Buffer, tag: Buffer): Promise<Buffer>;

  // Key derivation
  deriveKey(password: string, salt: Buffer): Promise<Buffer>;
}
```

## Implementation Steps

### Phase 1: Database & Models
1. Add EncryptionKey and TunnelEncryption models to Prisma schema
2. Create migration
3. Update Tunnel model with encryption relations

### Phase 2: Encryption Service
1. Implement key generation using Node.js crypto
2. Implement AES-256-GCM encryption/decryption
3. Implement RSA key pair generation
4. Add secure key storage with master key encryption

### Phase 3: API Routes
1. Create encryption settings endpoints
2. Create key management endpoints
3. Add encryption middleware for tunnel requests

### Phase 4: UI Components
1. Add encryption settings to tunnel detail page
2. Create key rotation interface
3. Show encryption status in tunnel list

### Phase 5: Testing
1. Unit tests for encryption service
2. Integration tests for API endpoints
3. Test key rotation scenarios

## Security Considerations

1. **Master Key**: Store master key in environment variable
2. **Private Key Storage**: Encrypt private keys before storing in DB
3. **Key Rotation**: Automatic rotation based on interval
4. **Secure Random**: Use crypto.randomBytes for all random values
5. **Memory Safety**: Clear sensitive data from memory after use

## Environment Variables

```env
# Master key for encrypting private keys (32 bytes hex)
ENCRYPTION_MASTER_KEY=your-32-byte-hex-key

# Key rotation check interval (hours)
KEY_ROTATION_CHECK_INTERVAL=24
```

## Usage Flow

### Enabling Encryption
1. User enables encryption for tunnel
2. System generates RSA key pair
3. Private key encrypted with master key and stored
4. Public key shared with clients

### Encrypted Request Flow
1. Client fetches tunnel's public key
2. Client generates session key
3. Client encrypts session key with RSA public key
4. Client encrypts payload with AES using session key
5. Server decrypts session key with RSA private key
6. Server decrypts payload with AES

### Key Rotation Flow
1. Check key expiration on each request
2. If expired or manual rotation requested:
   - Generate new key pair
   - Encrypt new private key
   - Store new keys
   - Mark old keys as rotated
3. Notify clients of key change

## Translations

### English
- encryption.title: "Encryption Settings"
- encryption.enable: "Enable Encryption"
- encryption.mode: "Encryption Mode"
- encryption.mode.e2e: "End-to-End"
- encryption.mode.transport: "Transport Layer"
- encryption.mode.none: "None (HTTPS only)"
- encryption.rotateKeys: "Rotate Keys"
- encryption.lastRotation: "Last Rotation"
- encryption.keyExpiry: "Key Expires"
- encryption.status.active: "Active"
- encryption.status.expired: "Expired"

### Arabic
- encryption.title: "إعدادات التشفير"
- encryption.enable: "تفعيل التشفير"
- encryption.mode: "وضع التشفير"
- encryption.mode.e2e: "من طرف إلى طرف"
- encryption.mode.transport: "طبقة النقل"
- encryption.mode.none: "بدون (HTTPS فقط)"
- encryption.rotateKeys: "تدوير المفاتيح"
- encryption.lastRotation: "آخر تدوير"
- encryption.keyExpiry: "انتهاء المفتاح"
- encryption.status.active: "نشط"
- encryption.status.expired: "منتهي"
