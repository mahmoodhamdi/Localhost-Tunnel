# Build stage
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

# Build the application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build --workspace=apps/server

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

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

# Copy Prisma files
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER tunnel

EXPOSE 3000
EXPOSE 7000

ENV PORT=3000
ENV TUNNEL_PORT=7000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:./data/tunnel.db"

CMD ["node", "apps/server/server.js"]
