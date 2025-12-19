# Localhost Tunnel

> Share your localhost with the world - securely and instantly!

[![CI/CD Pipeline](https://github.com/mahmoodhamdi/Localhost-Tunnel/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mahmoodhamdi/Localhost-Tunnel/actions/workflows/ci-cd.yml)
[![Docker](https://img.shields.io/docker/v/mwmsoftware/localhost-tunnel?label=Docker)](https://hub.docker.com/r/mwmsoftware/localhost-tunnel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Instant Public URLs** - Expose localhost in seconds
- **Secure Tunnels** - TLS encryption for all traffic
- **Request Inspection** - View, debug, and replay HTTP requests
- **Custom Subdomains** - Choose your own URL
- **Password Protection** - Secure your tunnels
- **WebSocket Support** - Full WS/WSS support
- **TCP Tunnels** - SSH, databases, and raw TCP connections
- **Analytics** - Traffic stats and insights
- **Subscriptions** - Tiered plans (Free, Starter, Pro, Enterprise)
- **Multi-Provider Payments** - Stripe, Paymob, PayTabs, Paddle
- **Regional Support** - Auto-selects payment provider by country
- **Bilingual** - English & Arabic with RTL support
- **Responsive** - Web dashboard for all devices
- **Docker** - Easy self-hosting

## Quick Start

### CLI Installation

```bash
# Using npm
npm install -g @localhost-tunnel/cli

# Create a tunnel
lt --port 3000

# With custom subdomain
lt --port 3000 --subdomain myapp
```

### Docker (Self-hosted)

```bash
docker pull mwmsoftware/localhost-tunnel:latest

docker run -d \
  -p 3000:3000 \
  -p 7000:7000 \
  -v tunnel_data:/app/data \
  mwmsoftware/localhost-tunnel:latest
```

Or using Docker Compose:

```bash
cd docker
docker-compose up -d
```

## CLI Usage

```bash
# Basic tunnel
lt --port 3000

# Custom subdomain
lt --port 3000 --subdomain my-app

# Password protected
lt --port 3000 --password secret

# TCP tunnel
lt --port 22 --tcp

# Custom server
lt --port 3000 --server https://your-server.com

# Show help
lt --help

# Show active tunnels
lt status

# Configure defaults
lt config --server https://your-server.com
lt config --port 8080
```

## Web Dashboard

Access the web dashboard at `http://localhost:3000` after starting the server.

### Screenshots

<details>
<summary><b>Main Pages (English)</b></summary>

#### Home Page
The landing page showcasing all features and quick start guide.

![Home Page](docs/screenshots/en/01-home.png)

#### Dashboard
Overview of your active tunnels, statistics, and recent activity.

![Dashboard](docs/screenshots/en/02-dashboard.png)

#### Tunnels List
Manage all your tunnels - view status, copy URLs, and delete.

![Tunnels List](docs/screenshots/en/03-tunnels-list.png)

#### Create Tunnel
Create new tunnels with custom subdomain, port, password, and IP whitelist.

![Create Tunnel](docs/screenshots/en/04-create-tunnel.png)

#### Create Tunnel (Filled Form)
Example of a tunnel configuration with all options filled in.

![Create Tunnel Filled](docs/screenshots/en/05-create-tunnel-filled.png)

#### Tunnel Detail
View detailed information about a specific tunnel including public URL and stats.

![Tunnel Detail](docs/screenshots/en/06-tunnel-detail.png)

#### Request Inspector
Live view of all HTTP requests passing through your tunnel with replay capability.

![Request Inspector](docs/screenshots/en/07-tunnel-inspector.png)

#### Teams
Collaborate with team members on shared tunnels.

![Teams](docs/screenshots/en/08-teams-list.png)

#### Create Team
Create a new team and invite members.

![Create Team](docs/screenshots/en/09-create-team.png)

#### Settings
Configure your profile, notifications, and preferences.

![Settings](docs/screenshots/en/13-settings.png)

#### API Keys
Manage your API keys for programmatic access.

![API Keys](docs/screenshots/en/14-api-keys.png)

#### Analytics
View detailed traffic statistics, charts, and insights.

![Analytics](docs/screenshots/en/15-analytics.png)

#### Documentation
Comprehensive guides and tutorials for using the service.

![Documentation](docs/screenshots/en/16-docs.png)

#### API Documentation
Interactive API documentation with examples and try-it functionality.

![API Docs](docs/screenshots/en/17-api-docs.png)

</details>

<details>
<summary><b>Arabic RTL Support (العربية)</b></summary>

Full right-to-left (RTL) support for Arabic language users.

#### Home Page (Arabic)
![Home Arabic](docs/screenshots/ar/01-home-ar.png)

#### Dashboard (Arabic)
![Dashboard Arabic](docs/screenshots/ar/02-dashboard-ar.png)

#### Tunnels (Arabic)
![Tunnels Arabic](docs/screenshots/ar/03-tunnels-list-ar.png)

#### Create Tunnel (Arabic)
![Create Tunnel Arabic](docs/screenshots/ar/04-create-tunnel-ar.png)

#### Settings (Arabic)
![Settings Arabic](docs/screenshots/ar/13-settings-ar.png)

#### Analytics (Arabic)
![Analytics Arabic](docs/screenshots/ar/15-analytics-ar.png)

</details>

<details>
<summary><b>Authentication</b></summary>

#### Login Page
Secure login with email/password or OAuth providers.

![Login](docs/screenshots/auth/01-login.png)

#### Register Page
Create a new account with email verification.

![Register](docs/screenshots/auth/03-register.png)

#### Forgot Password
Reset your password via email.

![Forgot Password](docs/screenshots/auth/05-forgot-password.png)

#### Form Validation
Client-side validation with helpful error messages.

![Validation](docs/screenshots/auth/07-login-validation.png)

</details>

<details>
<summary><b>Responsive Design</b></summary>

The dashboard is fully responsive and works on all devices.

#### Mobile View
| Home | Dashboard | Tunnels |
|------|-----------|---------|
| ![Mobile Home](docs/screenshots/responsive/01-mobile-home.png) | ![Mobile Dashboard](docs/screenshots/responsive/02-mobile-dashboard.png) | ![Mobile Tunnels](docs/screenshots/responsive/03-mobile-tunnels.png) |

#### Tablet View
| Home | Dashboard |
|------|-----------|
| ![Tablet Home](docs/screenshots/responsive/05-tablet-home.png) | ![Tablet Dashboard](docs/screenshots/responsive/06-tablet-dashboard.png) |

#### Desktop View
| Home | Dashboard |
|------|-----------|
| ![Desktop Home](docs/screenshots/responsive/07-desktop-home.png) | ![Desktop Dashboard](docs/screenshots/responsive/08-desktop-dashboard.png) |

</details>

<details>
<summary><b>Dark & Light Themes</b></summary>

Both themes are available with automatic system preference detection.

#### Light Theme
| Home | Dashboard | Tunnels |
|------|-----------|---------|
| ![Light Home](docs/screenshots/themes/01-light-home.png) | ![Light Dashboard](docs/screenshots/themes/03-light-dashboard.png) | ![Light Tunnels](docs/screenshots/themes/05-light-tunnels.png) |

#### Dark Theme
| Home | Dashboard | Tunnels |
|------|-----------|---------|
| ![Dark Home](docs/screenshots/themes/02-dark-home.png) | ![Dark Dashboard](docs/screenshots/themes/04-dark-dashboard.png) | ![Dark Tunnels](docs/screenshots/themes/06-dark-tunnels.png) |

</details>

<details>
<summary><b>Authenticated User Experience</b></summary>

Screenshots captured with a logged-in user account showing the full authenticated experience.

#### Dashboard (Authenticated)
User dashboard showing personalized stats and active tunnels.

![Dashboard Authenticated](docs/screenshots/authenticated/01-dashboard-authenticated.png)

#### Tunnels Management
View and manage your personal tunnels.

![Tunnels Authenticated](docs/screenshots/authenticated/02-tunnels-list-authenticated.png)

#### Create Tunnel (Authenticated)
Create a new tunnel with all options available.

| Empty Form | Filled Form |
|------------|-------------|
| ![Create Tunnel](docs/screenshots/authenticated/03-create-tunnel-authenticated.png) | ![Create Tunnel Filled](docs/screenshots/authenticated/04-create-tunnel-filled.png) |

#### Teams & Collaboration
Manage your teams and invite members.

| Teams List | Create Team |
|------------|-------------|
| ![Teams](docs/screenshots/authenticated/05-teams-authenticated.png) | ![Create Team](docs/screenshots/authenticated/06-create-team-authenticated.png) |

#### Settings & API Keys
Configure your account settings and manage API keys.

| Settings | API Keys |
|----------|----------|
| ![Settings](docs/screenshots/authenticated/08-settings-authenticated.png) | ![API Keys](docs/screenshots/authenticated/09-api-keys-authenticated.png) |

#### Analytics
View detailed traffic analytics for your tunnels.

![Analytics Authenticated](docs/screenshots/authenticated/10-analytics-authenticated.png)

#### Dark Theme (Authenticated)
Full dark theme support for authenticated users.

![Dark Dashboard Authenticated](docs/screenshots/authenticated/11-dashboard-dark-authenticated.png)

#### Arabic RTL (Authenticated)
Arabic interface with RTL support.

![Arabic Dashboard Authenticated](docs/screenshots/authenticated/12-dashboard-ar-authenticated.png)

#### Mobile (Authenticated)
Responsive mobile experience for logged-in users.

![Mobile Dashboard Authenticated](docs/screenshots/authenticated/13-dashboard-mobile-authenticated.png)

</details>

### Available Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview of your tunnels, stats, and recent activity |
| **Tunnels** | List and manage all your active tunnels |
| **Create Tunnel** | Create new tunnels with custom subdomain, password, and IP whitelist |
| **Tunnel Detail** | View detailed info, public URL, and request logs |
| **Request Inspector** | Live HTTP request viewer with replay capability |
| **Teams** | Collaborate with team members on shared tunnels |
| **Analytics** | Traffic statistics, charts, and insights |
| **Billing** | Subscription management, upgrade plans, payment history |
| **Settings** | Profile, notifications, and preferences |
| **API Keys** | Manage API keys for programmatic access |
| **Documentation** | Guides and tutorials |
| **API Docs** | Interactive API documentation |

## Subscription Tiers

| Feature | Free | Starter ($9/mo) | Pro ($29/mo) | Enterprise ($99/mo) |
|---------|------|-----------------|--------------|---------------------|
| Tunnels | 1 | 3 | 10 | Unlimited |
| Custom Subdomain | ❌ | ✅ | ✅ | ✅ |
| Custom Domain | ❌ | ❌ | ✅ | ✅ |
| TCP Tunnels | ❌ | ✅ | ✅ | ✅ |
| Requests/Day | 1,000 | 10,000 | 100,000 | Unlimited |
| Timeout | 1 hour | None | None | None |
| Priority Support | ❌ | ❌ | ✅ | ✅ |
| Team Members | 1 | 3 | 10 | Unlimited |

### Payment Providers

The system automatically selects the best payment provider based on your country:

| Region | Provider | Features |
|--------|----------|----------|
| **International** | Stripe | Cards, wallets |
| **Egypt** | Paymob | Cards, Vodafone Cash, Aman, Masary |
| **MENA** | PayTabs | Cards, Mada, Apple Pay, Google Pay |
| **EU** | Paddle | MoR with VAT handling |

## API Usage

### Create Tunnel

```bash
curl -X POST http://localhost:3000/api/tunnels \
  -H "Content-Type: application/json" \
  -d '{
    "localPort": 3000,
    "subdomain": "my-app"
  }'
```

### List Tunnels

```bash
curl http://localhost:3000/api/tunnels
```

### Delete Tunnel

```bash
curl -X DELETE http://localhost:3000/api/tunnels/{id}
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## Security Features

- **TLS Encryption** - All tunnel traffic is encrypted
- **Password Protection** - Optional password for tunnel access
- **IP Whitelisting** - Restrict access by IP address
- **Tunnel Expiration** - Auto-expire tunnels after a set time
- **Rate Limiting** - Prevent abuse with request limits

## Development

### Prerequisites

- Node.js 18+
- npm 10+

### Setup

```bash
# Clone the repository
git clone https://github.com/mahmoodhamdi/Localhost-Tunnel.git
cd Localhost-Tunnel

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests with coverage
npm run test:coverage
```

### Building

```bash
# Build all packages
npm run build

# Build Docker image
docker build -f docker/Dockerfile -t localhost-tunnel .
```

## Tech Stack

- **Server:** Next.js 14, WebSocket (ws), http-proxy
- **CLI:** Node.js, Commander.js
- **Database:** SQLite/PostgreSQL + Prisma
- **UI:** Tailwind CSS, shadcn/ui, Recharts
- **i18n:** next-intl (English & Arabic)
- **Testing:** Vitest, Playwright
- **CI/CD:** GitHub Actions
- **Container:** Docker

## Project Structure

```
localhost-tunnel/
├── apps/
│   ├── server/          # Next.js web server
│   │   ├── src/
│   │   │   ├── app/     # Next.js app router
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── i18n/
│   │   ├── prisma/
│   │   ├── __tests__/   # Unit, integration, E2E tests
│   │   └── messages/    # i18n translations
│   └── cli/             # CLI client
│       ├── src/
│       └── bin/
├── packages/
│   └── shared/          # Shared types and utils
├── docs/
│   └── screenshots/     # E2E test screenshots
│       ├── en/          # English pages
│       ├── ar/          # Arabic pages (RTL)
│       ├── auth/        # Authentication pages
│       ├── responsive/  # Mobile, tablet, desktop
│       └── themes/      # Light & dark themes
├── docker/
└── .github/workflows/
```

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Tunnel Server
TUNNEL_DOMAIN="localhost:3000"
TUNNEL_PORT=7000

# Payment Providers (configure only those you need)
# Stripe (International)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Paymob (Egypt)
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_ID_CARD=...
PAYMOB_HMAC_SECRET=...

# PayTabs (MENA)
PAYTABS_PROFILE_ID=...
PAYTABS_SERVER_KEY=...
PAYTABS_REGION=SAU  # SAU, ARE, EGY, OMN, JOR

# Paddle (EU)
PADDLE_VENDOR_ID=...
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_SANDBOX=true
```

See `.env.example` for complete configuration options.

## Contact

For support, questions, or business inquiries:

- **Email:** mwm.softwars.solutions@gmail.com
- **Email:** hmdy7486@gmail.com
- **Phone:** +201019793768
- **GitHub:** [mahmoodhamdi](https://github.com/mahmoodhamdi)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with love by MWM Software Solutions

