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
- **Analytics** - Traffic stats and insights
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

### Available Pages

- **Dashboard** - Overview of your tunnels and stats
- **Tunnels** - Manage your active tunnels
- **Create Tunnel** - Create new tunnels with custom options
- **Analytics** - View traffic statistics
- **Documentation** - Learn how to use the service
- **Settings** - Configure your preferences

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
│   │   └── messages/    # i18n translations
│   └── cli/             # CLI client
│       ├── src/
│       └── bin/
├── packages/
│   └── shared/          # Shared types and utils
├── docker/
├── .github/workflows/
└── screenshots/
```

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Tunnel Server
TUNNEL_DOMAIN="localhost:3000"
TUNNEL_PORT=7000
```

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
