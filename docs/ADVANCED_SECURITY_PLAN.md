# Advanced Security Feature Plan

## Overview

Implement enterprise-grade security features for tunnels:
- Rate Limiting per IP
- IP Geofencing
- Audit Logs

## Database Schema

### New Models

```prisma
model RateLimitRule {
  id          String   @id @default(cuid())
  name        String
  enabled     Boolean  @default(true)

  // Rate limit settings
  requestsPerMinute Int    @default(60)
  requestsPerHour   Int    @default(1000)
  burstLimit        Int    @default(100)

  // Response when rate limited
  blockDuration     Int    @default(60) // seconds
  customMessage     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Tunnel association (optional, null = global rule)
  tunnelId String?
  tunnel   Tunnel? @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  // User association
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tunnelId])
  @@index([userId])
}

model GeoRule {
  id        String   @id @default(cuid())
  name      String
  enabled   Boolean  @default(true)

  // Geo settings
  mode      String   @default("ALLOW") // ALLOW or BLOCK
  countries String   // Comma-separated country codes (US,UK,DE)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Tunnel association (optional, null = global rule)
  tunnelId String?
  tunnel   Tunnel? @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  // User association
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tunnelId])
  @@index([userId])
}

model AuditLog {
  id        String   @id @default(cuid())

  // Event details
  action    String   // LOGIN, LOGOUT, CREATE_TUNNEL, DELETE_TUNNEL, etc.
  resource  String   // TUNNEL, TEAM, USER, API_KEY, etc.
  resourceId String?

  // Event context
  ipAddress  String?
  userAgent  String?
  country    String?
  city       String?

  // Event data
  details   String?  // JSON data
  status    String   @default("SUCCESS") // SUCCESS, FAILURE

  createdAt DateTime @default(now())

  // User association
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([createdAt])
}

model RateLimitHit {
  id        String   @id @default(cuid())

  ipAddress String
  tunnelId  String?
  count     Int      @default(1)

  windowStart DateTime @default(now())

  @@unique([ipAddress, tunnelId, windowStart])
  @@index([ipAddress])
  @@index([tunnelId])
  @@index([windowStart])
}
```

### Updated User Model

```prisma
model User {
  // ... existing fields

  rateLimitRules RateLimitRule[]
  geoRules       GeoRule[]
  auditLogs      AuditLog[]
}
```

### Updated Tunnel Model

```prisma
model Tunnel {
  // ... existing fields

  rateLimitRules RateLimitRule[]
  geoRules       GeoRule[]
}
```

## API Endpoints

### Rate Limiting
- `GET /api/security/rate-limits` - List user's rate limit rules
- `POST /api/security/rate-limits` - Create rate limit rule
- `PUT /api/security/rate-limits/:id` - Update rate limit rule
- `DELETE /api/security/rate-limits/:id` - Delete rate limit rule

### IP Geofencing
- `GET /api/security/geo-rules` - List user's geo rules
- `POST /api/security/geo-rules` - Create geo rule
- `PUT /api/security/geo-rules/:id` - Update geo rule
- `DELETE /api/security/geo-rules/:id` - Delete geo rule
- `GET /api/geo/lookup/:ip` - Lookup IP geolocation

### Audit Logs
- `GET /api/security/audit-logs` - List user's audit logs
- `GET /api/security/audit-logs/export` - Export audit logs (CSV/JSON)

## Rate Limiting Implementation

### In-Memory Rate Limiter

```typescript
// lib/security/rateLimiter.ts
interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  blockDuration: number;
}

class RateLimiter {
  private hits: Map<string, { count: number; timestamp: number }>;

  check(ip: string, config: RateLimitConfig): RateLimitResult;
  increment(ip: string): void;
  isBlocked(ip: string): boolean;
}
```

### Middleware Integration

```typescript
// middleware.ts
export async function rateLimitMiddleware(request: Request, tunnelId: string) {
  const ip = getClientIP(request);
  const rules = await getRateLimitRules(tunnelId);

  for (const rule of rules) {
    if (rule.enabled) {
      const result = rateLimiter.check(ip, rule);
      if (!result.allowed) {
        return new Response(rule.customMessage || 'Rate limited', {
          status: 429,
          headers: {
            'Retry-After': result.retryAfter.toString(),
            'X-RateLimit-Limit': rule.requestsPerMinute.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
          },
        });
      }
    }
  }
}
```

## IP Geofencing Implementation

### Geolocation Service

Using free IP geolocation API (ip-api.com or similar):

```typescript
// lib/security/geoip.ts
interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
}

async function lookupIP(ip: string): Promise<GeoLocation>;
```

### Geo Filtering Middleware

```typescript
// middleware.ts
export async function geoFilterMiddleware(request: Request, tunnelId: string) {
  const ip = getClientIP(request);
  const location = await lookupIP(ip);
  const rules = await getGeoRules(tunnelId);

  for (const rule of rules) {
    if (rule.enabled) {
      const countries = rule.countries.split(',');
      const isMatch = countries.includes(location.countryCode);

      if (rule.mode === 'BLOCK' && isMatch) {
        return new Response('Access denied from your region', { status: 403 });
      }
      if (rule.mode === 'ALLOW' && !isMatch) {
        return new Response('Access denied from your region', { status: 403 });
      }
    }
  }
}
```

## Audit Logging Implementation

### Logger Service

```typescript
// lib/security/auditLogger.ts
interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  status: 'SUCCESS' | 'FAILURE';
}

class AuditLogger {
  async log(userId: string, event: AuditEvent, request?: Request): Promise<void>;
}

// Usage
await auditLogger.log(userId, {
  action: 'CREATE_TUNNEL',
  resource: 'TUNNEL',
  resourceId: tunnel.id,
  details: { subdomain: tunnel.subdomain },
  status: 'SUCCESS',
}, request);
```

### Event Types

| Action | Resource | Description |
|--------|----------|-------------|
| LOGIN | USER | User login |
| LOGOUT | USER | User logout |
| CREATE | TUNNEL | Tunnel created |
| UPDATE | TUNNEL | Tunnel updated |
| DELETE | TUNNEL | Tunnel deleted |
| CREATE | TEAM | Team created |
| UPDATE | TEAM | Team updated |
| DELETE | TEAM | Team deleted |
| INVITE | TEAM_MEMBER | Member invited |
| JOIN | TEAM | Member joined |
| LEAVE | TEAM | Member left |
| CREATE | API_KEY | API key created |
| REVOKE | API_KEY | API key revoked |
| CREATE | RATE_LIMIT_RULE | Rate limit rule created |
| UPDATE | RATE_LIMIT_RULE | Rate limit rule updated |
| DELETE | RATE_LIMIT_RULE | Rate limit rule deleted |
| CREATE | GEO_RULE | Geo rule created |
| UPDATE | GEO_RULE | Geo rule updated |
| DELETE | GEO_RULE | Geo rule deleted |

## Pages

### New Pages
- `/settings/security` - Security settings overview
- `/settings/security/rate-limits` - Rate limit rules management
- `/settings/security/geo-rules` - Geo rules management
- `/settings/security/audit-logs` - Audit logs viewer

## Translations

Add to `en.json` and `ar.json`:
```json
{
  "security": {
    "title": "Security",
    "subtitle": "Protect your tunnels with advanced security features",
    "rateLimit": {
      "title": "Rate Limiting",
      "subtitle": "Control request rates per IP address",
      "create": "Create Rule",
      "requestsPerMinute": "Requests per minute",
      "requestsPerHour": "Requests per hour",
      "burstLimit": "Burst limit",
      "blockDuration": "Block duration (seconds)",
      "customMessage": "Custom blocked message",
      "enabled": "Enabled",
      "noRules": "No rate limit rules"
    },
    "geoRule": {
      "title": "IP Geofencing",
      "subtitle": "Allow or block access by country",
      "create": "Create Rule",
      "mode": "Mode",
      "allowMode": "Allow only these countries",
      "blockMode": "Block these countries",
      "countries": "Countries",
      "selectCountries": "Select countries",
      "noRules": "No geo rules"
    },
    "auditLogs": {
      "title": "Audit Logs",
      "subtitle": "Track all security-related events",
      "action": "Action",
      "resource": "Resource",
      "ipAddress": "IP Address",
      "country": "Country",
      "timestamp": "Timestamp",
      "status": "Status",
      "details": "Details",
      "export": "Export",
      "noLogs": "No audit logs"
    }
  }
}
```

## Testing Plan

### Unit Tests
- Rate limiter logic (sliding window, token bucket)
- IP geolocation parsing
- Audit log event formatting
- Country code validation

### Integration Tests
- Rate limit rule CRUD
- Geo rule CRUD
- Audit log creation
- Rate limit middleware
- Geo filter middleware

### E2E Tests
- Create rate limit rule flow
- Create geo rule flow
- View audit logs flow
- Rate limited request handling
- Geo blocked request handling

## File Structure

```
apps/server/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── security/
│   │   │       ├── rate-limits/
│   │   │       │   ├── route.ts
│   │   │       │   └── [id]/route.ts
│   │   │       ├── geo-rules/
│   │   │       │   ├── route.ts
│   │   │       │   └── [id]/route.ts
│   │   │       └── audit-logs/
│   │   │           ├── route.ts
│   │   │           └── export/route.ts
│   │   └── [locale]/
│   │       └── settings/
│   │           └── security/
│   │               ├── page.tsx
│   │               ├── rate-limits/page.tsx
│   │               ├── geo-rules/page.tsx
│   │               └── audit-logs/page.tsx
│   └── lib/
│       └── security/
│           ├── rateLimiter.ts
│           ├── geoip.ts
│           └── auditLogger.ts
└── __tests__/
    ├── unit/
    │   └── security.test.ts
    └── integration/
        └── security.test.ts
```

## Implementation Steps

### Step 1: Update Prisma Schema
Add RateLimitRule, GeoRule, AuditLog, and RateLimitHit models

### Step 2: Create Security Library
- Rate limiter with sliding window algorithm
- IP geolocation service
- Audit logger service

### Step 3: Create Security API Routes
- Rate limit rules CRUD
- Geo rules CRUD
- Audit logs listing and export

### Step 4: Create Security UI Pages
- Security overview
- Rate limit management
- Geo rule management
- Audit log viewer

### Step 5: Add Translations
- Add security translations for EN/AR

### Step 6: Write Tests
- Unit tests for security logic
- Integration tests for API routes

### Step 7: Commit and Push
- Ensure all tests pass
- Create feature commit
