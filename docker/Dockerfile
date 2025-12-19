# Build stage
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files (all workspaces needed for npm ci to work correctly)
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/
COPY apps/cli/package.json ./apps/cli/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

# Build the shared package first (server depends on it)
RUN npm run build --workspace=packages/shared

# Install stripe explicitly if not hoisted from workspace
RUN npm install stripe --workspace=apps/server 2>/dev/null || true

# Build the server application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build --workspace=apps/server

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Install wget for healthcheck and openssl for Prisma
RUN apk add --no-cache wget openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 tunnel

# Copy public files
COPY --from=builder /app/apps/server/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown tunnel:nodejs .next

# Copy standalone output
COPY --from=builder --chown=tunnel:nodejs /app/apps/server/.next/standalone ./
COPY --from=builder --chown=tunnel:nodejs /app/apps/server/.next/static ./.next/static

# Copy Prisma files (CLI + generated client)
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Create data directory for SQLite and set permissions
RUN mkdir -p data && chown tunnel:nodejs data

# Copy startup script
COPY --from=builder --chown=tunnel:nodejs /app/docker/start.sh ./start.sh
RUN chmod +x start.sh

USER tunnel

EXPOSE 3000
EXPOSE 7000

ENV PORT=3000
ENV TUNNEL_PORT=7000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:./data/tunnel.db"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["./start.sh"]
