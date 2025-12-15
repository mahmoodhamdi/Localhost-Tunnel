import WebSocket from 'ws';
import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import fs from 'fs';
import { MessageType, type WSMessage, type RequestMessage, type ResponseMessage } from '@localhost-tunnel/shared';
import type { TunnelOptions, ActiveTunnel } from '../types.js';
import { logger } from '../utils/logger.js';

// Exponential backoff configuration
const RECONNECT_CONFIG = {
  baseDelay: 1000,      // Start with 1 second
  maxDelay: 60000,      // Max 60 seconds
  maxAttempts: 10,      // Max reconnect attempts before giving up
  jitterFactor: 0.3,    // Add 0-30% random jitter
};

export class TunnelAgent extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: TunnelOptions;
  private serverUrl: string;
  private reconnecting = false;
  private closed = false;
  private reconnectAttempts = 0;
  public tunnel: ActiveTunnel | null = null;

  constructor(options: TunnelOptions, serverUrl: string) {
    super();
    this.options = options;
    this.serverUrl = serverUrl;
  }

  // Calculate delay with exponential backoff and jitter
  private getReconnectDelay(): number {
    const exponentialDelay = RECONNECT_CONFIG.baseDelay * Math.pow(2, this.reconnectAttempts);
    const cappedDelay = Math.min(exponentialDelay, RECONNECT_CONFIG.maxDelay);
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * RECONNECT_CONFIG.jitterFactor * Math.random();
    return cappedDelay + jitter;
  }

  async connect(): Promise<ActiveTunnel> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.serverUrl.replace('http', 'ws') + '/tunnel';

      // Configure WebSocket options with TLS settings
      const wsOptions: WebSocket.ClientOptions = {};

      // Set up TLS options for secure connections (wss://)
      if (wsUrl.startsWith('wss://')) {
        // By default, reject unauthorized certificates for security
        wsOptions.rejectUnauthorized = !this.options.insecure;

        // If insecure mode is enabled, warn the user
        if (this.options.insecure) {
          logger.warning('TLS certificate verification disabled. This is insecure and should only be used for development.');
        }

        // Load custom CA certificate if provided
        if (this.options.ca) {
          try {
            const caCert = fs.readFileSync(this.options.ca);
            wsOptions.ca = caCert;
            logger.dim(`Using custom CA certificate: ${this.options.ca}`);
          } catch (error) {
            logger.error(`Failed to read CA certificate: ${this.options.ca}`);
            reject(new Error('Failed to read CA certificate'));
            return;
          }
        }
      }

      this.ws = new WebSocket(wsUrl, wsOptions);

      this.ws.on('open', () => {
        // Register tunnel
        const registerMessage = {
          type: MessageType.REGISTER,
          payload: {
            subdomain: this.options.subdomain,
            localPort: this.options.port,
            localHost: this.options.host || 'localhost',
            password: this.options.password,
          },
        };
        this.ws!.send(JSON.stringify(registerMessage));
      });

      this.ws.on('message', (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(message, resolve, reject);
        } catch (error) {
          logger.error('Failed to parse message');
        }
      });

      this.ws.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`);
        reject(error);
      });

      this.ws.on('close', () => {
        if (!this.closed && !this.reconnecting) {
          this.emit('disconnected');
          this.tryReconnect();
        }
      });
    });
  }

  private handleMessage(
    message: WSMessage,
    resolve: (tunnel: ActiveTunnel) => void,
    reject: (error: Error) => void,
  ): void {
    switch (message.type) {
      case MessageType.REGISTERED: {
        const payload = message.payload as {
          tunnelId: string;
          subdomain: string;
          publicUrl: string;
        };

        this.tunnel = {
          id: payload.tunnelId,
          subdomain: payload.subdomain,
          publicUrl: payload.publicUrl,
          localPort: this.options.port,
          localHost: this.options.host || 'localhost',
          createdAt: new Date(),
        };

        this.emit('connected', this.tunnel);
        resolve(this.tunnel);
        break;
      }

      case MessageType.REQUEST: {
        const requestMessage = message as RequestMessage;
        this.forwardRequest(requestMessage);
        break;
      }

      case MessageType.ERROR: {
        const errorPayload = message.payload as { code: string; message: string };
        logger.error(errorPayload.message);
        reject(new Error(errorPayload.message));
        break;
      }

      case MessageType.PONG: {
        // Keep-alive response
        break;
      }
    }
  }

  private async forwardRequest(message: RequestMessage): Promise<void> {
    const { requestId, payload } = message;
    const { method, path, headers, body } = payload;

    const localHost = this.options.host || 'localhost';
    const localPort = this.options.port;
    const url = `http://${localHost}:${localPort}${path}`;

    try {
      const response = await this.makeRequest(url, method, headers, body);

      const responseMessage: ResponseMessage = {
        type: MessageType.RESPONSE,
        requestId,
        payload: {
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body,
        },
      };

      this.ws?.send(JSON.stringify(responseMessage));
      this.emit('request', { method, path, statusCode: response.statusCode });
    } catch (error) {
      const responseMessage: ResponseMessage = {
        type: MessageType.RESPONSE,
        requestId,
        payload: {
          statusCode: 502,
          headers: { 'content-type': 'text/plain' },
          body: 'Bad Gateway: Local server not responding',
        },
      };

      this.ws?.send(JSON.stringify(responseMessage));
      this.emit('request', { method, path, statusCode: 502 });
    }
  }

  private makeRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
      };

      const req = lib.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers as Record<string, string>,
            body: responseBody,
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  private tryReconnect(): void {
    if (this.closed || this.reconnecting) return;

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= RECONNECT_CONFIG.maxAttempts) {
      logger.error(`Failed to reconnect after ${RECONNECT_CONFIG.maxAttempts} attempts. Giving up.`);
      this.emit('reconnect_failed', { attempts: this.reconnectAttempts });
      this.close();
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempts++;

    const delay = this.getReconnectDelay();
    const delaySeconds = (delay / 1000).toFixed(1);
    logger.warning(`Connection lost. Reconnecting in ${delaySeconds}s... (attempt ${this.reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts})`);

    setTimeout(async () => {
      this.reconnecting = false;
      if (!this.closed) {
        try {
          await this.connect();
          // Reset attempts on successful reconnection
          this.reconnectAttempts = 0;
          logger.success('Reconnected!');
          this.emit('reconnected', this.tunnel);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Reconnection failed: ${errorMessage}`);
          this.tryReconnect();
        }
      }
    }, delay);
  }

  close(): void {
    this.closed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit('closed');
  }

  ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: MessageType.PING }));
    }
  }
}
