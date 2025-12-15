#!/bin/sh
set -e

echo "Starting Localhost Tunnel Server..."

# Run database migrations
echo "Running database migrations..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

echo "Database ready!"

# Start the server
echo "Starting Node.js server..."
exec node server.js
