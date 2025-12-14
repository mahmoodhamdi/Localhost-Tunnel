# Health Checks Feature Plan

## Overview
Implement comprehensive health monitoring for tunnels, services, and system components with automated alerts and status dashboards.

## Features

### 1. Tunnel Health Checks
- Check tunnel connectivity and responsiveness
- Monitor local server availability
- Track response times and latency
- Detect connection drops and reconnections

### 2. System Health Checks
- Database connectivity
- Memory and CPU usage
- Disk space monitoring
- Service dependencies status

### 3. Health Check Configuration
- Custom check intervals
- Timeout configuration
- Retry policies
- Alert thresholds

### 4. Health Status Dashboard
- Real-time health status
- Historical uptime data
- Incident timeline
- Performance metrics

## Database Schema

```prisma
model HealthCheck {
  id            String   @id @default(cuid())
  name          String
  type          String   // TUNNEL, HTTP, TCP, DATABASE
  target        String   // URL or identifier to check
  enabled       Boolean  @default(true)

  // Check configuration
  interval      Int      @default(60)    // seconds
  timeout       Int      @default(30)    // seconds
  retries       Int      @default(3)

  // Alert configuration
  alertOnFailure    Boolean @default(true)
  alertAfterRetries Int     @default(2)

  // Current status
  status        String   @default("UNKNOWN") // HEALTHY, UNHEALTHY, DEGRADED, UNKNOWN
  lastCheck     DateTime?
  lastSuccess   DateTime?
  lastFailure   DateTime?
  consecutiveFails Int    @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Associations
  tunnelId      String?
  tunnel        Tunnel?  @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  results       HealthCheckResult[]

  @@index([tunnelId])
  @@index([userId])
  @@index([status])
}

model HealthCheckResult {
  id            String   @id @default(cuid())
  status        String   // SUCCESS, FAILURE, TIMEOUT
  responseTime  Int?     // milliseconds
  statusCode    Int?
  message       String?
  createdAt     DateTime @default(now())

  healthCheckId String
  healthCheck   HealthCheck @relation(fields: [healthCheckId], references: [id], onDelete: Cascade)

  @@index([healthCheckId])
  @@index([createdAt])
}
```

## API Endpoints

### Health Checks CRUD
- `GET /api/health` - System health status
- `GET /api/health/checks` - List all health checks
- `POST /api/health/checks` - Create health check
- `GET /api/health/checks/[id]` - Get health check details
- `PUT /api/health/checks/[id]` - Update health check
- `DELETE /api/health/checks/[id]` - Delete health check
- `POST /api/health/checks/[id]/run` - Manually run health check

### Tunnel Health
- `GET /api/tunnels/[id]/health` - Get tunnel health status
- `POST /api/tunnels/[id]/health/check` - Run tunnel health check

### Health Results
- `GET /api/health/checks/[id]/results` - Get check history

## Health Check Service

```typescript
interface HealthCheckService {
  // System health
  getSystemHealth(): Promise<SystemHealth>;

  // Run checks
  runCheck(checkId: string): Promise<HealthCheckResult>;
  runTunnelCheck(tunnelId: string): Promise<HealthCheckResult>;

  // Scheduling
  scheduleCheck(check: HealthCheck): void;
  cancelCheck(checkId: string): void;

  // Results
  getCheckHistory(checkId: string, limit?: number): Promise<HealthCheckResult[]>;
  getUptimeStats(checkId: string, period: string): Promise<UptimeStats>;
}

interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
  };
  timestamp: Date;
}
```

## Implementation Steps

### Phase 1: Core Health Check
1. Add HealthCheck and HealthCheckResult models
2. Create health check service
3. Implement basic HTTP health check

### Phase 2: API Routes
1. Create CRUD endpoints for health checks
2. Create system health endpoint
3. Create tunnel health endpoint

### Phase 3: Check Runners
1. Implement HTTP check runner
2. Implement TCP check runner
3. Implement tunnel connectivity check

### Phase 4: Scheduling
1. Background job for periodic checks
2. Check queue management
3. Result aggregation

## Health Check Types

### HTTP Check
- Send HTTP request to target URL
- Validate status code (2xx by default)
- Measure response time
- Optional body validation

### TCP Check
- Attempt TCP connection to host:port
- Validate connection success
- Measure connection time

### Tunnel Check
- Verify tunnel is active
- Check local server responsiveness
- Measure end-to-end latency

### Database Check
- Verify database connectivity
- Execute simple query
- Measure query time

## Status Definitions

| Status | Description |
|--------|-------------|
| HEALTHY | All checks passing |
| DEGRADED | Some checks failing, service partially available |
| UNHEALTHY | Critical checks failing, service unavailable |
| UNKNOWN | No check results yet or check disabled |

## Translations

### English
- health.title: "Health Checks"
- health.status.healthy: "Healthy"
- health.status.degraded: "Degraded"
- health.status.unhealthy: "Unhealthy"
- health.lastCheck: "Last Check"
- health.uptime: "Uptime"

### Arabic
- health.title: "فحوصات الصحة"
- health.status.healthy: "سليم"
- health.status.degraded: "متدهور"
- health.status.unhealthy: "غير سليم"
- health.lastCheck: "آخر فحص"
- health.uptime: "وقت التشغيل"
