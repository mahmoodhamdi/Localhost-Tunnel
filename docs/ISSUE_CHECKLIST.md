# Localhost Tunnel - Issue Checklist

Quick reference checklist for fixing all identified issues.

---

## Critical Issues (Fix Immediately) ❌

### FIX-01: Build Failure (hashSalt webpack error)
```bash
# Steps to fix:
cd apps/server
rm -rf .next node_modules
cd ../..
rm -rf node_modules
npm ci
npm run build
```
- [ ] Clear caches and reinstall dependencies
- [ ] Verify build succeeds
- [ ] If persists, check Next.js/SWC version compatibility

### FIX-02: ESLint Configuration Missing
```bash
# Create ESLint config:
echo '{"extends": "next/core-web-vitals"}' > apps/server/.eslintrc.json
```
- [ ] Create `.eslintrc.json` in `apps/server/`
- [ ] Run `npm run lint` to verify
- [ ] Update CI/CD if needed

### FIX-03: Add SMTP to .env.example
Add to `apps/server/.env.example`:
```env
# Email Service (Required for password reset and invitations)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM="Localhost Tunnel <noreply@example.com>"
```
- [ ] Add SMTP variables to .env.example
- [ ] Document email service setup in README

---

## High Priority Issues ⚠️

### FIX-04: Optimize Database Query on Every Request
**File:** `apps/server/src/lib/tunnel/manager.ts:395-401`
- [ ] Implement in-memory counter
- [ ] Batch update to database every N requests or M seconds
- [ ] Test performance improvement

### FIX-05: Add Graceful Shutdown Handling
**File:** `apps/server/src/lib/tunnel/manager.ts`
- [ ] Clear `cleanupTimer` on process exit
- [ ] Close all WebSocket connections gracefully
- [ ] Flush pending database operations

### FIX-06: Add Input Validation to All API Routes
- [ ] Review all API routes for input validation
- [ ] Add request body size limits
- [ ] Add rate limiting to file upload endpoint

---

## Medium Priority Issues 📋

- [ ] **MED-01:** Update Vitest to fix CJS deprecation warning
- [ ] **MED-02:** Make request timeout configurable (currently hardcoded 30s)
- [ ] **MED-03:** Complete disk health monitoring for Windows
- [ ] **MED-04:** Replace console.log with structured logger
- [ ] **MED-05:** Add missing database indexes (review slow queries)
- [ ] **MED-06:** Add pagination to analytics endpoint
- [ ] **MED-07:** Make WebSocket ping interval configurable
- [ ] **MED-08:** Add process.on('SIGTERM') handler

---

## Low Priority Issues 📝

- [ ] **LOW-01:** Clean up `any` types in test mocks where possible
- [ ] **LOW-02:** Add JSDoc documentation to public APIs
- [ ] **LOW-03:** Standardize error message format across all APIs
- [ ] **LOW-04:** Add rate limiting to upload endpoint
- [ ] **LOW-05:** Remove unused UNREGISTER message handler in CLI
- [ ] **LOW-06:** Clean up unused translation keys

---

## Missing Features to Implement 🚀

### CLI Enhancements
- [ ] Add `lt analytics` command to view tunnel statistics
- [ ] Add `lt whitelist` command for IP whitelist management
- [ ] Add `--expires` flag for tunnel expiration
- [ ] Implement UNREGISTER message or remove dead code

### Server Enhancements
- [ ] Real TCP socket health check (currently uses HTTP fallback)
- [ ] Complete disk monitoring for all platforms
- [ ] Add Redis support for session/cache storage

### Documentation
- [ ] Add API documentation with OpenAPI/Swagger
- [ ] Add architecture diagrams
- [ ] Add deployment guide for production

---

## Production Checklist 🔐

Before deploying to production:

- [ ] Set `ENCRYPTION_MASTER_KEY` (generate: `openssl rand -hex 32`)
- [ ] Set `AUTH_SECRET` (min 32 characters)
- [ ] Configure HTTPS/TLS certificates
- [ ] Set up reverse proxy (nginx/caddy)
- [ ] Configure CORS allowed origins
- [ ] Set up monitoring and alerting
- [ ] Configure database backups
- [ ] Set up log aggregation
- [ ] Configure rate limiting at infrastructure level
- [ ] Review and test all security measures

---

## Test Status

| Type | Count | Status |
|------|-------|--------|
| Unit Tests | 832 | ✅ Passing |
| Integration Tests | 406 | ✅ Passing |
| E2E Tests | - | ❌ Blocked (Build Error) |

**To run tests:**
```bash
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e         # E2E tests (requires build fix)
```

---

*Last Updated: 2025-12-16*
