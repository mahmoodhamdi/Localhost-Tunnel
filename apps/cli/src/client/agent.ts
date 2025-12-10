import WebSocket from 'ws';
import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { MessageType, type WSMessage, type RequestMessage, type ResponseMessage } from '@localhost-tunnel/shared';
import type { TunnelOptions, ActiveTunnel } from '../types.js';
import { logger } from '../utils/logger.js';

export class TunnelAgent extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: TunnelOptions;
  private serverUrl: string;
  private reconnecting = false;
  private closed = false;
  public tunnel: ActiveTunnel | null = null;

  constructor(options: TunnelOptions, serverUrl: string) {
    super();
    this.options = options;
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<ActiveTunnel> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.serverUrl.replace('http', 'ws') + '/tunnel';

      this.ws = new WebSocket(wsUrl);

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

    this.reconnecting = true;
    logger.warning('Connection lost. Reconnecting in 5 seconds...');

    setTimeout(async () => {
      this.reconnecting = false;
      if (!this.closed) {
        try {
          await this.connect();
          logger.success('Reconnected!');
        } catch {
          this.tryReconnect();
        }
      }
    }, 5000);
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
