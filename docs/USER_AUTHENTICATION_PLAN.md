# User Authentication Feature Plan

## Overview

Implement comprehensive user authentication using NextAuth.js to enable:
- User registration and login
- OAuth social login (GitHub, Google)
- API key management for programmatic access
- Protected routes and sessions

## Technical Stack

- **NextAuth.js v5** - Authentication library
- **Prisma Adapter** - Database integration
- **bcrypt** - Password hashing
- **JWT** - Session tokens

## Database Schema Changes

### New Models

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  password      String?   // For credentials auth
  image         String?
  role          UserRole  @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  apiKeys       ApiKey[]
  tunnels       Tunnel[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model ApiKey {
  id          String    @id @default(cuid())
  name        String
  key         String    @unique
  keyPrefix   String    // First 8 chars for display
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  userId      String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum UserRole {
  USER
  ADMIN
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/callback/credentials` - Login with email/password
- `GET /api/auth/session` - Get current session
- `POST /api/auth/signout` - Logout

### API Keys
- `GET /api/keys` - List user's API keys
- `POST /api/keys` - Create new API key
- `DELETE /api/keys/[id]` - Revoke API key

## Pages

### New Pages
- `/auth/login` - Login page with OAuth buttons
- `/auth/register` - Registration page
- `/auth/error` - Auth error page
- `/settings/api-keys` - API key management

### Protected Pages (require auth)
- `/dashboard` - User dashboard
- `/tunnels` - User's tunnels
- `/analytics` - User's analytics
- `/settings` - User settings

## Implementation Steps

### Step 1: Install Dependencies
```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

### Step 2: Update Prisma Schema
Add User, Account, Session, VerificationToken, ApiKey models

### Step 3: Configure NextAuth
- Create `auth.ts` configuration
- Set up providers (Credentials, GitHub, Google)
- Configure Prisma adapter

### Step 4: Create Auth API Routes
- `/api/auth/[...nextauth]` - NextAuth handler
- `/api/auth/register` - Registration endpoint

### Step 5: Create UI Pages
- Login page with form and OAuth buttons
- Register page with form
- API keys management page

### Step 6: Add Middleware
- Protect routes that require authentication
- Redirect unauthenticated users to login

### Step 7: Update Existing Features
- Associate tunnels with users
- Filter data by user ownership
- Add user context to all pages

## Security Considerations

1. **Password Security**
   - Hash with bcrypt (12 rounds)
   - Minimum 8 characters
   - No common passwords

2. **API Keys**
   - Generate with crypto.randomBytes
   - Store hashed version
   - Show full key only once on creation

3. **Session Security**
   - HTTP-only cookies
   - Secure in production
   - Short expiration with refresh

4. **OAuth Security**
   - Verify email domain
   - Link accounts by email

## Testing Plan

### Unit Tests
- Password hashing/verification
- API key generation
- Session validation
- Input validation

### Integration Tests
- Registration flow
- Login flow
- OAuth callback handling
- API key CRUD

### E2E Tests
- Full registration journey
- Login with credentials
- OAuth login simulation
- Protected route access

## Translations

Add to `en.json` and `ar.json`:
```json
{
  "auth": {
    "login": "Login",
    "register": "Register",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "forgotPassword": "Forgot Password?",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "orContinueWith": "Or continue with",
    "loginWithGithub": "Continue with GitHub",
    "loginWithGoogle": "Continue with Google",
    "errors": {
      "invalidCredentials": "Invalid email or password",
      "emailExists": "Email already registered",
      "weakPassword": "Password too weak",
      "passwordMismatch": "Passwords don't match"
    }
  },
  "apiKeys": {
    "title": "API Keys",
    "subtitle": "Manage your API keys for programmatic access",
    "create": "Create API Key",
    "name": "Key Name",
    "key": "API Key",
    "created": "Created",
    "lastUsed": "Last Used",
    "expires": "Expires",
    "never": "Never",
    "revoke": "Revoke",
    "copyWarning": "Copy this key now. You won't be able to see it again!",
    "noKeys": "No API keys yet"
  }
}
```

## File Structure

```
apps/server/
├── src/
│   ├── auth.ts                           # NextAuth config
│   ├── middleware.ts                     # Route protection
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts
│   │   │   │   └── register/route.ts
│   │   │   └── keys/
│   │   │       ├── route.ts
│   │   │       └── [id]/route.ts
│   │   └── [locale]/
│   │       ├── auth/
│   │       │   ├── login/page.tsx
│   │       │   ├── register/page.tsx
│   │       │   └── error/page.tsx
│   │       └── settings/
│   │           └── api-keys/page.tsx
│   └── components/
│       └── auth/
│           ├── LoginForm.tsx
│           ├── RegisterForm.tsx
│           ├── OAuthButtons.tsx
│           └── UserMenu.tsx
└── __tests__/
    ├── unit/
    │   └── auth.test.ts
    ├── integration/
    │   └── auth.test.ts
    └── e2e/
        └── auth.spec.ts
```
