# Handover Checklist — Localhost Tunnel

**Client**: ___________________________
**Delivery date**: ____ / ____ / ______
**Tier**: ☐ Starter / ☐ Pro / ☐ Enterprise

---

## Infrastructure
- [ ] VPS (2 vCPU / 4 GB / 80 GB SSD)
- [ ] Ubuntu 22.04/24.04 patched
- [ ] ufw + Fail2ban
- [ ] Timezone configured

## Domain + Wildcard TLS
- [ ] DNS A record for the apex
- [ ] DNS A record (or CNAME) for *.your-domain
- [ ] Wildcard cert via Let's Encrypt DNS-01
- [ ] HSTS + HTTPS redirect

## Server App
- [ ] Node 20+
- [ ] `npm ci` + `npm run build` succeeded
- [ ] Prisma migrations applied (`prisma db push`)
- [ ] First admin created
- [ ] `.env` populated (DATABASE_URL, JWT_SECRET, payment keys)
- [ ] systemd service running
- [ ] Tunnel server listening on the public port

## CLI
- [ ] Built and published (npm public, private registry, or GitHub Release)
- [ ] First-tunnel test successful end-to-end

## Payments
- [ ] Stripe keys + webhook configured
- [ ] Paymob keys configured (if MENA)
- [ ] PayTabs keys configured (if GCC)
- [ ] Paddle keys configured (if SaaS)
- [ ] Test transactions for each provider

## Security
- [ ] npm audit clean
- [ ] `.env` chmod 600
- [ ] Rate limiting verified
- [ ] Default admin password CHANGED

## Training
- [ ] Admin dashboard walkthrough (30 min)
- [ ] CLI demo (15 min)
- [ ] First-tunnel-and-debug demo (15 min)

## Documentation
- [ ] README + DEPLOYMENT.md shared
- [ ] API docs accessible at /api-docs
- [ ] SUPPORT-PLANS signed
- [ ] This checklist signed

## 24h go/no-go
- [ ] Admin login
- [ ] Create a tunnel via CLI
- [ ] Public URL works
- [ ] Request inspection shows the request
- [ ] Subscription upgrade flow works for at least one payment provider

---

**Client**: ____________________  Date: ____ / ____ / ______
**Developer**: Mahmoud Hamdy — Date: ____ / ____ / ______
