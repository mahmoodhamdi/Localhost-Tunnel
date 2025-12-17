/**
 * Development WebSocket Server
 * Run this alongside `npm run dev` to enable CLI connections in development
 *
 * Usage: node dev-ws-server.js
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const TUNNEL_PORT = process.env.TUNNEL_PORT || 7000;
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'localhost:3000';

// Store active tunnels
const tunnels = new Map();
// Store pending requests
const pendingRequests = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tunnels: tunnels.size }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/tunnel' });

console.log(`Starting WebSocket server on port ${TUNNEL_PORT}...`);

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  let tunnelId = null;
  let subdomain = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'register': {
          const payload = message.payload;
          subdomain = payload.subdomain || generateSubdomain();
          tunnelId = `tn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

          // Store tunnel
          tunnels.set(subdomain, {
            id: tunnelId,
            ws,
            localPort: payload.localPort,
            localHost: payload.localHost || 'localhost',
            protocol: payload.protocol || 'HTTP',
            createdAt: new Date(),
          });

          const publicUrl = `http://${subdomain}.${TUNNEL_DOMAIN}`;

          console.log(`Tunnel registered: ${subdomain} -> localhost:${payload.localPort}`);
          console.log(`Public URL: ${publicUrl}`);

          // Send registered response
          ws.send(JSON.stringify({
            type: 'registered',
            payload: {
              tunnelId,
              subdomain,
              publicUrl,
              protocol: payload.protocol || 'HTTP',
            },
          }));
          break;
        }

        case 'response': {
          const { requestId, payload } = message;
          const pending = pendingRequests.get(requestId);
          if (pending) {
            pending.resolve(payload);
            pendingRequests.delete(requestId);
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (subdomain) {
      tunnels.delete(subdomain);
      console.log(`Tunnel disconnected: ${subdomain}`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function generateSubdomain() {
  const adjectives = ['happy', 'clever', 'swift', 'bright', 'calm'];
  const nouns = ['tunnel', 'bridge', 'portal', 'gate', 'link'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

// Forward request to tunnel
async function forwardRequest(subdomain, method, path, headers, body) {
  const tunnel = tunnels.get(subdomain);
  if (!tunnel) {
    return null;
  }

  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 30000);

    pendingRequests.set(requestId, {
      resolve: (response) => {
        clearTimeout(timeout);
        resolve(response);
      },
      reject,
    });

    tunnel.ws.send(JSON.stringify({
      type: 'request',
      requestId,
      payload: { method, path, headers, body },
    }));
  });
}

// Export for use by Next.js API routes
module.exports = { tunnels, forwardRequest };

server.listen(TUNNEL_PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${TUNNEL_PORT}/tunnel`);
  console.log(`Tunnel domain: ${TUNNEL_DOMAIN}`);
  console.log('');
  console.log('To create a tunnel, run:');
  console.log(`  lt --port 8080 --server http://localhost:${TUNNEL_PORT}`);
});
