# Localhost Tunnel — ngrok بديل عربي self-hosted

## لـ devs، شركات SaaS، فرق QA، agencies اللي عاوزين tunnel service خاص

> منصة tunnel كاملة (HTTP / WebSocket / TCP) مع dashboard، subscriptions،
> دفع متعدد المزودين (Stripe, Paymob, PayTabs, Paddle). CLI npm-installable.
> Docker self-host. Bilingual AR/EN. تركيب على دومين/سيرفر العميل يوم واحد.

---

## ليه النظام ده؟

| التحدي | اللي بيوفره النظام |
|--------|---------------------|
| ngrok بـ $8-$20/شهر لكل dev | نسخة self-hosted، تكلفة infra فقط |
| ngrok بيقفل tunnels في الـ free tier | unlimited tunnels على infra العميل |
| الـ subdomains random كل مرة | custom subdomains ثابتة |
| Compliance teams بترفض إرسال traffic لـ third-party tunnels | self-hosted = الـ traffic ع شبكة الـ company |
| الـ payment integration في مصر صعبة (Stripe بس) | 4 providers: Stripe + Paymob + PayTabs + Paddle |

---

## الجمهور المستهدف

- **شركات تقنية** عندها 10+ devs بيحتاجوا tunnels يومياً
- **Dev agencies** بيعرضوا شغلهم للعملاء قبل ما ينشروا
- **QA teams** بيختبروا webhooks من third-party services على local
- **SaaS startups** عاوزين يطلقوا منصة tunnel كـ product (B2B reseller)

---

## بترتكب في يوم واحد

| الساعة | النشاط |
|--------|--------|
| 1-2 | VPS + domain + TLS + wildcard DNS |
| 3 | DB migration + admin user |
| 4 | Stripe / Paymob / PayTabs credentials setup |
| 5 | CLI binary distribution (npm publish أو private registry) |
| 6 | Training + first tunnel |

---

## مميزات

### 1. كل أنواع الـ tunnels
- **HTTP/HTTPS** — مع inspection panel
- **WebSocket/WSS** — للـ real-time apps
- **TCP** — للـ SSH, databases, raw protocols

### 2. CLI experience
```bash
npm install -g @localhost-tunnel/cli
lt --port 3000 --subdomain myapp
# Public URL: https://myapp.your-domain.com
```

### 3. Web dashboard
- Tunnel management
- Request inspection (replay, debug)
- Analytics (traffic stats per tunnel)
- API keys management
- Team collaboration
- Bilingual AR/EN

### 4. Subscription tiers
- Free (1 tunnel, random subdomain)
- Starter ($5/mo, 5 tunnels, custom subdomains)
- Pro ($15/mo, unlimited, password protection)
- Enterprise (custom)

### 5. Multi-provider payments
- Stripe — international
- Paymob — Egypt
- PayTabs — GCC
- Paddle — software companies
- Auto-routing based on customer country

### 6. Self-hosted
- Docker image: `mwmsoftware/localhost-tunnel`
- Single VPS deployment
- SQLite default (PostgreSQL for scale)
- Wildcard SSL via Let's Encrypt + DNS-01

---

## الباقات

### Starter
**$1,500 / مرة واحدة + $50/شهر دعم**

- النظام كامل (server + CLI + dashboard)
- تركيب على VPS العميل
- Stripe integration setup
- شهر دعم
- 3 شهور warranty

### Pro
**$2,800 / مرة واحدة + $130/شهر دعم**

كل اللي في Starter، زائد:
- استضافة جاهزة سنة
- 4 payment providers setup (Stripe + Paymob + PayTabs + Paddle)
- CLI publish لـ npm public أو private registry
- branding كامل
- 6 شهور دعم priority

### Enterprise
**$6,500+ / مرة واحدة + $300/شهر دعم**

كل اللي في Pro، زائد:
- multi-region deployment
- white-label للـ B2B resellers
- custom tunnel protocols
- SAML SSO
- SLA 99.5%
- 12 شهر دعم

---

## للتواصل

**Mahmoud Hamdy — MWM Software Solutions**
📧 mwm.softwars.solutions@gmail.com

Demo 20 دقيقة بنوريك CLI + dashboard + payment flow حية.
