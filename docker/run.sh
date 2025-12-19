#!/bin/bash
# Bash script to start localhost-tunnel with automatic port detection
# Usage: ./run.sh [--web-port 3000] [--tunnel-port 7000]

set -e

WEB_PORT=${WEB_PORT:-3000}
TUNNEL_PORT=${TUNNEL_PORT:-7000}
MAX_RETRIES=10

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --web-port)
            WEB_PORT="$2"
            shift 2
            ;;
        --tunnel-port)
            TUNNEL_PORT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./run.sh [--web-port 3000] [--tunnel-port 7000]"
            exit 1
            ;;
    esac
done

# Function to check if port is available
is_port_available() {
    local port=$1
    if command -v nc &> /dev/null; then
        ! nc -z localhost "$port" 2>/dev/null
    elif command -v lsof &> /dev/null; then
        ! lsof -i ":$port" &> /dev/null
    else
        # Fallback: try to bind using Python
        python3 -c "import socket; s=socket.socket(); s.bind(('', $port)); s.close()" 2>/dev/null
    fi
}

# Function to find available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    local retries=0

    while [ $retries -lt $MAX_RETRIES ]; do
        if is_port_available $port; then
            echo $port
            return 0
        fi
        echo "Port $port is busy, trying next..." >&2
        port=$((port + 1))
        retries=$((retries + 1))
    done

    echo "Could not find available port in range $start_port-$((start_port + MAX_RETRIES - 1))" >&2
    return 1
}

echo -e "\033[36mStarting Localhost Tunnel...\033[0m"

# Find available ports
ACTUAL_WEB_PORT=$(find_available_port $WEB_PORT) || exit 1
ACTUAL_TUNNEL_PORT=$(find_available_port $TUNNEL_PORT) || exit 1

echo -e "\033[32mUsing ports: Web=$ACTUAL_WEB_PORT, Tunnel=$ACTUAL_TUNNEL_PORT\033[0m"

# Export for docker-compose
export WEB_PORT=$ACTUAL_WEB_PORT
export TUNNEL_PORT=$ACTUAL_TUNNEL_PORT

# Start docker-compose from the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

docker-compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo -e "\033[32mLocalhost Tunnel is running!\033[0m"
    echo -e "\033[33m  Web UI:     http://localhost:$ACTUAL_WEB_PORT\033[0m"
    echo -e "\033[33m  Tunnel:     ws://localhost:$ACTUAL_TUNNEL_PORT\033[0m"
    echo ""
    echo -e "\033[90mTo view logs: docker logs -f localhost-tunnel\033[0m"
    echo -e "\033[90mTo stop:      docker-compose down\033[0m"
fi
