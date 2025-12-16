# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm install              # Install all dependencies (monorepo)
npm run db:generate      # Generate Prisma client (required before first run)
npm run db:push          # Push database schema to SQLite
npm run dev              # Start all apps in development mode (turbo)
```

### Testing
```bash
npm run test:unit        # Run unit tests (Vitest)
npm run test:integration # Run integration tests
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:coverage    # Run all tests with coverage

# Run a single test file
cd apps/server && npx vitest run __tests__/unit/auth.test.ts
cd apps/server && npx vitest run --config vitest.integration.config.ts __tests__/integration/api.test.ts

# Watch mode for development
cd apps/server && npx vitest __tests__/unit/
cd apps/server && npx vitest --config vitest.integration.config.ts __tests__/integration/

# Run specific E2E test
cd apps/server && npx playwright test __tests__/e2e/tunnel.spec.ts
cd apps/server && npx playwright test --headed  # Run with browser visible
```

### Building
```bash
npm run build            # Build all packages
npm run lint             # Lint all packages
```

### Database
```bash
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio (run in apps/server)

# Migration (for production schema changes)
cd apps/server && npx prisma migrate dev --name migration_name
```

### CLI (apps/cli)
```bash
cd apps/cli && npm run build   # Build CLI
lt --port 3000                 # Create tunnel (after global install)
```

## Architecture

This is a **Turborepo monorepo** for a localhost tunneling service (similar to ngrok/localtunnel).

### Packages

- **apps/server**: Next.js 14 web server with dashboard and tunnel relay
  - Uses App Router with `[locale]` segment for i18n (English/Arabic)
  - WebSocket server at `/tunnel` endpoint handles CLI connections
  - `TunnelManager` (src/lib/tunnel/manager.ts) is the core singleton managing active tunnels
  - Uses Prisma with SQLite for persistence
  - Auth via NextAuth v5 (src/auth.ts) with credentials, GitHub, Google providers
  - State management via Zustand stores (src/lib/stores/)

- **apps/cli**: Node.js CLI client (`lt` command)
  - `TunnelAgent` (src/client/agent.ts) handles WebSocket connection to server
  - Forwards HTTP/TCP requests from public URL to local server
  - Supports `--tcp` flag for raw TCP tunneling (SSH, databases, etc.)

- **packages/shared**: Shared types and constants
  - `MessageType` enum and WebSocket message interfaces
  - `TunnelConfig`, `TunnelInfo`, `RequestLog` types
  - Used by both server and CLI

### Data Flow

1. CLI connects via WebSocket and sends `REGISTER` message
2. Server creates tunnel entry, returns `REGISTERED` with public URL
3. HTTP requests to `subdomain.{TUNNEL_DOMAIN}` are captured by server
4. Server sends `REQUEST` message to CLI over WebSocket
5. CLI makes local HTTP request, returns `RESPONSE` message
6. Server responds to original HTTP request

### Key Files

- `apps/server/src/lib/tunnel/manager.ts` - Tunnel lifecycle and request forwarding
- `apps/server/src/lib/tunnel/auth.ts` - Password hashing, IP whitelist
- `apps/server/src/lib/api/withApiHandler.ts` - API wrapper with error handling and logging
- `apps/server/src/lib/api/withAuth.ts` - Auth middleware for protected routes
- `apps/server/src/lib/tracing/index.ts` - Distributed tracing with W3C Trace Context
- `apps/server/src/lib/security/auditLogger.ts` - Security audit logging
- `apps/server/src/lib/health/healthCheck.ts` - System health monitoring
- `apps/server/src/lib/retention/dataRetention.ts` - Data retention policies
- `apps/server/src/lib/firebase/admin.ts` - Firebase Admin SDK initialization
- `apps/server/src/lib/firebase/fcm.ts` - FCM push notifications service
- `apps/server/src/lib/notifications/tunnel-notifications.ts` - Tunnel event notifications
- `apps/server/src/lib/email/emailService.ts` - Email service using Nodemailer
- `apps/cli/src/client/agent.ts` - CLI tunnel agent
- `packages/shared/src/types.ts` - Shared TypeScript types
- `apps/server/prisma/schema.prisma` - Database schema

### API Pattern

API routes use wrappers for consistent error handling:

```typescript
// Public route with error handling
export const GET = withApiHandler(async (request, { params, logger }) => {
  // handler code
  return success(data);
});

// Protected route requiring authentication
export const POST = withAuth(async (request, { user, logger, params }) => {
  // user is guaranteed to be authenticated
  return success(data);
});

// Admin-only route
export const DELETE = withAdminAuth(async (request, { user, logger, params }) => {
  return success(data);
});
```

Use `ApiException` factory methods for errors: `ApiException.badRequest()`, `ApiException.notFound()`, `ApiException.forbidden()`, `ApiException.unauthorized()`, `ApiException.conflict()`, `ApiException.internal()`.

Helper functions:
- `getParam(params, 'id')` - Extract route params with validation
- `parseBody<T>(request)` - Parse and type request body JSON

### i18n

- Translations in `apps/server/messages/{en,ar}.json`
- Uses `next-intl` with locale routing at `[locale]` path segment
- RTL support for Arabic

### Environment Variables

```env
DATABASE_URL="file:./dev.db"    # SQLite path
TUNNEL_DOMAIN="localhost:3000"  # Public domain for tunnel URLs
TUNNEL_PORT=7000                # WebSocket server port
TCP_PORT_RANGE_START=10000      # Starting port for TCP tunnels
TCP_PORT_RANGE_END=20000        # Ending port for TCP tunnels

# OAuth (optional)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Firebase / FCM Push Notifications (optional)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'  # or use path below
FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"  # for development
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...  # Web push VAPID key
```

### Test Structure

- `apps/server/__tests__/unit/` - Unit tests (jsdom environment), files: `*.test.ts`
- `apps/server/__tests__/integration/` - API integration tests (node environment), files: `*.test.ts`
- `apps/server/__tests__/e2e/` - Playwright browser tests, files: `*.spec.ts`

Unit tests use `vitest.config.ts`, integration tests use `vitest.integration.config.ts`, E2E tests use `playwright.config.ts`.

### Path Aliases

The server uses `@/` alias pointing to `apps/server/src/`. Example: `import { prisma } from '@/lib/db/prisma'`.

### Observability

- **Distributed Tracing**: W3C Trace Context standard support via `traceparent`/`tracestate` headers
- **Audit Logging**: Security events logged via `AuditLogger` (login, tunnel create/delete, etc.)
- **Health Checks**: System health endpoint with database, memory, and disk status
- **Push Notifications**: Firebase Cloud Messaging (FCM) for tunnel events (connect, disconnect, errors)
