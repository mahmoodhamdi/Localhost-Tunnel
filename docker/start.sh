#!/bin/sh
set -e

echo "Starting Localhost Tunnel Server..."

# Initialize database if needed (creates db file on first run)
if [ ! -f "./data/tunnel.db" ]; then
    echo "Initializing database..."
    # Use node to run prisma db push via the installed prisma package
    node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --accept-data-loss 2>/dev/null || echo "Database initialization skipped"
fi

echo "Database ready!"

# Start the server (standalone output is in apps/server/)
echo "Starting Node.js server..."
exec node apps/server/server.js
