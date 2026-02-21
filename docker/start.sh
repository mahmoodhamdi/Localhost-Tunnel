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

# Start the server - detect correct path for standalone output
echo "Starting Node.js server..."
if [ -f "server.js" ]; then
    exec node server.js
elif [ -f "apps/server/server.js" ]; then
    exec node apps/server/server.js
else
    echo "ERROR: server.js not found. Searching..."
    find . -name "server.js" -maxdepth 3 -type f 2>/dev/null
    exit 1
fi
