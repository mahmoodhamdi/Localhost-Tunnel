# Features Inventory — Localhost Tunnel

Legend: ✅ ships / 🟡 caveat / 🔵 optional / ⛔ out of scope

---

## Tunnels
| Feature | Status | Notes |
|---------|:------:|-------|
| HTTP/HTTPS tunnels | ✅ | wildcard TLS |
| WebSocket / WSS | ✅ | |
| TCP tunnels (SSH, DBs) | ✅ | |
| Custom subdomains | ✅ | |
| Password-protected tunnels | ✅ | |
| Request inspection (view/replay) | ✅ | |
| Tunnel-specific access tokens | ✅ | |

## CLI
| Feature | Status | Notes |
|---------|:------:|-------|
| Single-port forward | ✅ | `lt --port 3000` |
| Custom subdomain flag | ✅ | `--subdomain myapp` |
| Multiple ports per CLI session | 🟡 | spawn one process per port |
| Config file (`~/.lt/config`) | ✅ | |
| Auto-update notification | ✅ | |
| `lt status` + `lt logs` | ✅ | |

## Web Dashboard
| Feature | Status | Notes |
|---------|:------:|-------|
| Tunnel CRUD | ✅ | |
| Request inspection panel | ✅ | with body diff |
| Analytics (per-tunnel traffic) | ✅ | |
| API key management | ✅ | |
| Team collaboration | ✅ | invite + RBAC |
| Bilingual AR/EN | ✅ | RTL ready |
| Mobile responsive | ✅ | |

## Subscriptions & Billing
| Feature | Status | Notes |
|---------|:------:|-------|
| Tier-based plans (Free/Starter/Pro/Enterprise) | ✅ | |
| Stripe integration | ✅ | |
| Paymob integration | ✅ | MENA |
| PayTabs integration | ✅ | GCC |
| Paddle integration | ✅ | |
| Country-based provider auto-routing | ✅ | |
| Invoice PDF generation | ✅ | |
| Subscription pause/resume | ✅ | |
| Trial periods | ✅ | |

## Admin
| Feature | Status | Notes |
|---------|:------:|-------|
| User management | ✅ | |
| Tunnel monitoring | ✅ | |
| Subscription overrides | ✅ | |
| Audit log | ✅ | |
| Platform analytics | ✅ | |

## Security & Ops
| Feature | Status | Notes |
|---------|:------:|-------|
| TLS 1.2/1.3 on all tunnels | ✅ | wildcard SSL |
| Rate limiting per user/tunnel | ✅ | |
| API key auth | ✅ | |
| JWT dashboard sessions | ✅ | |
| Audit logging | ✅ | |
| Self-hosted via Docker | ✅ | |
| Prisma migrations | ✅ | SQLite default, PostgreSQL for scale |

## Out of Scope
| Feature | Why |
|---------|-----|
| Mobile native apps | Web dashboard is responsive; PWA in v2 |
| Distributed multi-region | Enterprise custom build |
| On-prem agent for corp networks | Different product class |
