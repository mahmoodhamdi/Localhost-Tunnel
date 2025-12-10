import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
  MessageType,
  type WSMessage,
  type RequestMessage,
  type ResponseMessage,
  generateRequestId,
} from '@localhost-tunnel/shared';
import { prisma } from '../db/prisma';
import { generateSubdomain, validateSubdomain, normalizeSubdomain } from './subdomain';
import { hashPassword, verifyPassword, parseIpWhitelist, isIpAllowed } from './auth';

interface TunnelConnection {
  id: string;
  subdomain: string;
  ws: WebSocket;
  localPort: number;
  localHost: string;
  createdAt: Date;
  pendingRequests: Map<string, {
    resolve: (response: ResponseMessage['payload']) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

interface CreateTunnelOptions {
  subdomain?: string;
  localPort: number;
  localHost?: string;
  password?: string;
  ipWhitelist?: string;
  expiresAt?: Date | null;
  inspect?: boolean;
}

class TunnelManager extends EventEmitter {
  private connections: Map<string, TunnelConnection> = new Map();
  private subdomainToId: Map<string, string> = new Map();
  private requestTimeout = 30000; // 30 seconds

  async createTunnel(
    ws: WebSocket,
    options: CreateTunnelOptions,
  ): Promise<{ tunnelId: string; subdomain: string; publicUrl: string }> {
    let subdomain = options.subdomain
      ? normalizeSubdomain(options.subdomain)
      : generateSubdomain();

    // Validate subdomain
    if (options.subdomain) {
      const validation = validateSubdomain(subdomain);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Check if subdomain is already in use
    if (this.subdomainToId.has(subdomain)) {
      if (options.subdomain) {
        throw new Error('Subdomain is already in use');
      }
      // Generate a new random subdomain
      subdomain = generateSubdomain();
    }

    // Check database for existing subdomain
    const existing = await prisma.tunnel.findUnique({
      where: { subdomain },
    });

    if (existing && existing.isActive) {
      if (options.subdomain) {
        throw new Error('Subdomain is already in use');
      }
      subdomain = generateSubdomain();
    }

    // Hash password if provided
    const hashedPassword = options.password
      ? await hashPassword(options.password)
      : null;

    // Create or update tunnel in database
    const tunnel = await prisma.tunnel.upsert({
      where: { subdomain },
      update: {
        localPort: options.localPort,
        localHost: options.localHost || 'localhost',
        password: hashedPassword,
        ipWhitelist: options.ipWhitelist || null,
        expiresAt: options.expiresAt || null,
        inspect: options.inspect ?? true,
        isActive: true,
        lastActiveAt: new Date(),
      },
      create: {
        subdomain,
        localPort: options.localPort,
        localHost: options.localHost || 'localhost',
        password: hashedPassword,
        ipWhitelist: options.ipWhitelist || null,
        expiresAt: options.expiresAt || null,
        inspect: options.inspect ?? true,
        isActive: true,
      },
    });

    // Store connection
    const connection: TunnelConnection = {
      id: tunnel.id,
      subdomain,
      ws,
      localPort: options.localPort,
      localHost: options.localHost || 'localhost',
      createdAt: new Date(),
      pendingRequests: new Map(),
    };

    this.connections.set(tunnel.id, connection);
    this.subdomainToId.set(subdomain, tunnel.id);

    // Handle WebSocket close
    ws.on('close', () => {
      this.removeTunnel(tunnel.id);
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(tunnel.id, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    const domain = process.env.TUNNEL_DOMAIN || 'localhost:3000';
    const publicUrl = `http://${subdomain}.${domain}`;

    this.emit('tunnel:created', { tunnelId: tunnel.id, subdomain, publicUrl });

    return {
      tunnelId: tunnel.id,
      subdomain,
      publicUrl,
    };
  }

  async removeTunnel(tunnelId: string): Promise<void> {
    const connection = this.connections.get(tunnelId);
    if (!connection) return;

    // Reject all pending requests
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Tunnel closed'));
    }

    this.connections.delete(tunnelId);
    this.subdomainToId.delete(connection.subdomain);

    // Update database
    await prisma.tunnel.update({
      where: { id: tunnelId },
      data: { isActive: false },
    });

    this.emit('tunnel:closed', { tunnelId, subdomain: connection.subdomain });
  }

  async forwardRequest(
    subdomain: string,
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: string;
      ip?: string;
    },
  ): Promise<ResponseMessage['payload']> {
    const tunnelId = this.subdomainToId.get(subdomain);
    if (!tunnelId) {
      throw new Error('Tunnel not found');
    }

    const connection = this.connections.get(tunnelId);
    if (!connection) {
      throw new Error('Tunnel not found');
    }

    // Check tunnel expiration
    const tunnel = await prisma.tunnel.findUnique({
      where: { id: tunnelId },
    });

    if (!tunnel) {
      throw new Error('Tunnel not found');
    }

    if (tunnel.expiresAt && new Date(tunnel.expiresAt) < new Date()) {
      throw new Error('Tunnel has expired');
    }

    // Check IP whitelist
    if (request.ip && tunnel.ipWhitelist) {
      const whitelist = parseIpWhitelist(tunnel.ipWhitelist);
      if (!isIpAllowed(request.ip, whitelist)) {
        throw new Error('IP not allowed');
      }
    }

    const requestId = generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      connection.pendingRequests.set(requestId, { resolve, reject, timeout });

      const message: RequestMessage = {
        type: MessageType.REQUEST,
        requestId,
        payload: {
          method: request.method,
          path: request.path,
          headers: request.headers,
          body: request.body,
        },
      };

      connection.ws.send(JSON.stringify(message));

      // Update tunnel stats
      prisma.tunnel.update({
        where: { id: tunnelId },
        data: {
          totalRequests: { increment: 1 },
          lastActiveAt: new Date(),
        },
      }).catch(console.error);
    });
  }

  async verifyTunnelPassword(subdomain: string, password: string): Promise<boolean> {
    const tunnel = await prisma.tunnel.findUnique({
      where: { subdomain },
    });

    if (!tunnel || !tunnel.password) {
      return true; // No password required
    }

    return verifyPassword(password, tunnel.password);
  }

  isTunnelPasswordProtected(subdomain: string): Promise<boolean> {
    return prisma.tunnel.findUnique({
      where: { subdomain },
      select: { password: true },
    }).then((tunnel) => !!tunnel?.password);
  }

  private handleMessage(tunnelId: string, message: WSMessage): void {
    const connection = this.connections.get(tunnelId);
    if (!connection) return;

    switch (message.type) {
      case MessageType.RESPONSE: {
        const responseMessage = message as ResponseMessage;
        const pending = connection.pendingRequests.get(responseMessage.requestId!);
        if (pending) {
          clearTimeout(pending.timeout);
          connection.pendingRequests.delete(responseMessage.requestId!);
          pending.resolve(responseMessage.payload);
        }
        break;
      }
      case MessageType.PING: {
        connection.ws.send(JSON.stringify({ type: MessageType.PONG }));
        break;
      }
    }
  }

  getTunnelBySubdomain(subdomain: string): TunnelConnection | undefined {
    const tunnelId = this.subdomainToId.get(subdomain);
    return tunnelId ? this.connections.get(tunnelId) : undefined;
  }

  getActiveTunnels(): TunnelConnection[] {
    return Array.from(this.connections.values());
  }

  getTunnelCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const tunnelManager = new TunnelManager();
