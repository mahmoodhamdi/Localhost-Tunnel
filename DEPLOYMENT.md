# Customer Deployment Guide — Localhost Tunnel

## Scenario A — العميل عنده infrastructure

### يقدمه العميل
- VPS (2 vCPU / 4 GB RAM / 80 GB SSD)
- Domain + DNS (need wildcard for *.your-domain.com)
- Stripe / Paymob / PayTabs / Paddle accounts (whichever applies)

### نقدمه نحن
- ✅ كل الـ source code (monorepo: server + CLI + shared)
- ✅ Dockerfile + docker-compose
- ✅ env.example + DEPLOY.md
- ✅ Prisma migrations
- ✅ CLI binary build instructions
- ✅ 90-min Zoom deployment session
- ✅ 60-min training
- ✅ Support حسب الـ tier

### Timeline (1 day)
- VPS + DNS (incl. wildcard) + TLS
- Deploy server + first admin user
- CLI install + first tunnel test
- Training + go-live

---

## Scenario B — إحنا اللي بنشتري ونجهز

### يقدمه العميل
- بيانات الشركة
- domain
- بيانات الـ payment providers

### نقدمه نحن
- ✅ كل اللي في Scenario A
- ✅ VPS + Domain + DNS setup
- ✅ Wildcard SSL via Let's Encrypt DNS-01
- ✅ CLI npm publish (private or public)
- ✅ Backup + monitoring
- ✅ 3 شهور Pro support

### تكاليف infra
| البند | شهرياً |
|------|-------|
| VPS | $10–$20 |
| Domain | $1 |
| Backups | $2 |

---

## Compliance
- 🔒 TLS 1.2/1.3 على kل tunnels
- 🔒 Wildcard SSL
- 🔒 API key auth للـ CLI
- 🔒 JWT للـ dashboard
- 🔒 Password-protected tunnels
- 🔒 Rate limiting per user + per tunnel
- 🔒 Audit log per tunnel session
