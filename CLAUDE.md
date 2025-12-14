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

- **apps/cli**: Node.js CLI client (`lt` command)
  - `TunnelAgent` (src/client/agent.ts) handles WebSocket connection to server
  - Forwards HTTP requests from public URL to local server

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
- `apps/cli/src/client/agent.ts` - CLI tunnel agent
- `packages/shared/src/types.ts` - Shared TypeScript types
- `apps/server/prisma/schema.prisma` - Database schema

### i18n

- Translations in `apps/server/messages/{en,ar}.json`
- Uses `next-intl` with locale routing at `[locale]` path segment
- RTL support for Arabic

### Environment Variables

```env
DATABASE_URL="file:./dev.db"    # SQLite path
TUNNEL_DOMAIN="localhost:3000"  # Public domain for tunnel URLs
TUNNEL_PORT=7000                # WebSocket server port
```

### Test Structure

- `apps/server/__tests__/unit/` - Unit tests (auth, subdomain validation)
- `apps/server/__tests__/integration/` - API integration tests
- `apps/server/__tests__/e2e/` - Playwright browser tests
