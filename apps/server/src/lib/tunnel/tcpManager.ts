import * as net from 'net';
import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { MessageType, type TcpConnectMessage, type TcpDataMessage, type TcpCloseMessage } from '@localhost-tunnel/shared';
import { randomBytes } from 'crypto';

interface TcpTunnelConnection {
  id: string;
  subdomain: string;
  ws: WebSocket;
  localPort: number;
  tcpPort: number; // Public TCP port
  server: net.Server;
  activeConnections: Map<string, net.Socket>;
  createdAt: Date;
}

interface TcpConnectionInfo {
  tunnelId: string;
  socket: net.Socket;
  connectionId: string;
}

// TCP port allocation range (avoid well-known ports)
const TCP_PORT_MIN = 10000;
const TCP_PORT_MAX = 65535;

class TcpTunnelManager extends EventEmitter {
  private tunnels: Map<string, TcpTunnelConnection> = new Map();
  private subdomainToId: Map<string, string> = new Map();
  private portToId: Map<number, string> = new Map();
  private usedPorts: Set<number> = new Set();

  private generateConnectionId(): string {
    return randomBytes(16).toString('hex');
  }

  private async findAvailablePort(): Promise<number> {
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const port = Math.floor(Math.random() * (TCP_PORT_MAX - TCP_PORT_MIN + 1)) + TCP_PORT_MIN;

      if (this.usedPorts.has(port)) {
        continue;
      }

      // Try to bind to the port to check if it's available
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        return port;
      }
    }

    throw new Error('No available TCP ports');
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '0.0.0.0');
    });
  }

  async createTcpTunnel(
    ws: WebSocket,
    options: {
      subdomain: string;
      localPort: number;
      tunnelId: string;
    }
  ): Promise<{ tcpPort: number; publicUrl: string }> {
    const { subdomain, localPort, tunnelId } = options;

    // Check if tunnel already exists
    if (this.subdomainToId.has(subdomain)) {
      throw new Error('TCP tunnel already exists for this subdomain');
    }

    // Find an available port
    const tcpPort = await this.findAvailablePort();

    // Create TCP server for this tunnel
    const server = net.createServer();

    const tunnel: TcpTunnelConnection = {
      id: tunnelId,
      subdomain,
      ws,
      localPort,
      tcpPort,
      server,
      activeConnections: new Map(),
      createdAt: new Date(),
    };

    // Handle incoming TCP connections
    server.on('connection', (socket) => {
      this.handleIncomingConnection(tunnel, socket);
    });

    server.on('error', (error) => {
      console.error(`TCP server error for ${subdomain}:`, error);
      this.removeTcpTunnel(tunnelId);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      server.listen(tcpPort, '0.0.0.0', () => {
        resolve();
      });
      server.once('error', reject);
    });

    // Store tunnel
    this.tunnels.set(tunnelId, tunnel);
    this.subdomainToId.set(subdomain, tunnelId);
    this.portToId.set(tcpPort, tunnelId);
    this.usedPorts.add(tcpPort);

    // Handle WebSocket messages for TCP data
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWsMessage(tunnelId, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      this.removeTcpTunnel(tunnelId);
    });

    ws.on('error', () => {
      this.removeTcpTunnel(tunnelId);
    });

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const host = domain.split(':')[0];
    const publicUrl = `tcp://${host}:${tcpPort}`;

    this.emit('tcp:created', { tunnelId, subdomain, tcpPort, publicUrl });

    return { tcpPort, publicUrl };
  }

  private handleIncomingConnection(tunnel: TcpTunnelConnection, socket: net.Socket): void {
    const connectionId = this.generateConnectionId();
    tunnel.activeConnections.set(connectionId, socket);

    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;

    // Notify client about new TCP connection
    const connectMessage: TcpConnectMessage = {
      type: MessageType.TCP_CONNECT,
      connectionId,
      payload: {
        remoteAddress,
        remotePort,
        localPort: tunnel.localPort,
      },
    };

    tunnel.ws.send(JSON.stringify(connectMessage));

    // Handle incoming data from remote client
    socket.on('data', (data) => {
      const dataMessage: TcpDataMessage = {
        type: MessageType.TCP_DATA,
        connectionId,
        payload: {
          data: data.toString('base64'),
        },
      };

      tunnel.ws.send(JSON.stringify(dataMessage));
    });

    // Handle connection close
    socket.on('close', () => {
      tunnel.activeConnections.delete(connectionId);

      const closeMessage: TcpCloseMessage = {
        type: MessageType.TCP_CLOSE,
        connectionId,
      };

      tunnel.ws.send(JSON.stringify(closeMessage));
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`TCP connection error for ${connectionId}:`, error);
      tunnel.activeConnections.delete(connectionId);
    });

    this.emit('tcp:connection', { tunnelId: tunnel.id, connectionId, remoteAddress, remotePort });
  }

  private handleWsMessage(tunnelId: string, message: { type: MessageType; connectionId?: string; payload?: unknown }): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return;

    switch (message.type) {
      case MessageType.TCP_DATA: {
        const dataMsg = message as TcpDataMessage;
        const socket = tunnel.activeConnections.get(dataMsg.connectionId);
        if (socket && !socket.destroyed) {
          const data = Buffer.from(dataMsg.payload.data, 'base64');
          socket.write(data);
        }
        break;
      }

      case MessageType.TCP_CLOSE: {
        const closeMsg = message as TcpCloseMessage;
        const socket = tunnel.activeConnections.get(closeMsg.connectionId);
        if (socket) {
          socket.end();
          tunnel.activeConnections.delete(closeMsg.connectionId);
        }
        break;
      }

      case MessageType.TCP_ERROR: {
        const errorMsg = message as { connectionId: string };
        const socket = tunnel.activeConnections.get(errorMsg.connectionId);
        if (socket) {
          socket.destroy();
          tunnel.activeConnections.delete(errorMsg.connectionId);
        }
        break;
      }
    }
  }

  removeTcpTunnel(tunnelId: string): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return;

    // Close all active TCP connections
    for (const [, socket] of tunnel.activeConnections) {
      socket.destroy();
    }
    tunnel.activeConnections.clear();

    // Close TCP server
    tunnel.server.close();

    // Clean up maps
    this.tunnels.delete(tunnelId);
    this.subdomainToId.delete(tunnel.subdomain);
    this.portToId.delete(tunnel.tcpPort);
    this.usedPorts.delete(tunnel.tcpPort);

    this.emit('tcp:closed', { tunnelId, subdomain: tunnel.subdomain, tcpPort: tunnel.tcpPort });
  }

  getTunnelBySubdomain(subdomain: string): TcpTunnelConnection | undefined {
    const tunnelId = this.subdomainToId.get(subdomain);
    return tunnelId ? this.tunnels.get(tunnelId) : undefined;
  }

  getTunnelByPort(port: number): TcpTunnelConnection | undefined {
    const tunnelId = this.portToId.get(port);
    return tunnelId ? this.tunnels.get(tunnelId) : undefined;
  }

  getActiveTunnels(): TcpTunnelConnection[] {
    return Array.from(this.tunnels.values());
  }

  getTunnelCount(): number {
    return this.tunnels.size;
  }

  getConnectionCount(): number {
    let count = 0;
    for (const tunnel of this.tunnels.values()) {
      count += tunnel.activeConnections.size;
    }
    return count;
  }
}

// Singleton instance
export const tcpTunnelManager = new TcpTunnelManager();
