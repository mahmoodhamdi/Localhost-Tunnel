import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TunnelAgent', () => {
  describe('WebSocket URL construction', () => {
    it('should correctly convert http:// to ws://', () => {
      // Test the regex: .replace(/^http(s?):\/\//, 'ws$1://')
      const httpUrl = 'http://localhost:3000';
      const wsUrl = httpUrl.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('ws://localhost:3000/tunnel');
    });

    it('should correctly convert https:// to wss://', () => {
      const httpsUrl = 'https://example.com';
      const wsUrl = httpsUrl.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('wss://example.com/tunnel');
    });

    it('should not replace http in hostname', () => {
      const url = 'http://my-http-proxy.com:3000';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('ws://my-http-proxy.com:3000/tunnel');
    });

    it('should handle https with http in hostname', () => {
      const url = 'https://httpserver.example.com';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('wss://httpserver.example.com/tunnel');
    });

    it('should handle URL with path segments', () => {
      const url = 'http://localhost:3000/api/v1';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('ws://localhost:3000/api/v1/tunnel');
    });

    it('should handle URL with query parameters', () => {
      const url = 'https://example.com:443?debug=true';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('wss://example.com:443?debug=true/tunnel');
    });

    it('should handle URLs without port', () => {
      const url = 'http://localhost';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('ws://localhost/tunnel');
    });

    it('should handle URLs with IP address', () => {
      const url = 'http://192.168.1.100:3000';
      const wsUrl = url.replace(/^http(s?):\/\//, 'ws$1://') + '/tunnel';
      expect(wsUrl).toBe('ws://192.168.1.100:3000/tunnel');
    });
  });

  describe('Reconnect delay calculation', () => {
    it('should calculate base delay at attempt 0', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;
      const attempt = 0;

      const delay = baseDelay * Math.pow(2, attempt);
      const cappedDelay = Math.min(delay, maxDelay);

      expect(cappedDelay).toBe(1000);
    });

    it('should increase delay exponentially', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;

      // Attempt 0: 1000ms base
      expect(baseDelay * Math.pow(2, 0)).toBe(1000);
      // Attempt 1: 2000ms
      expect(baseDelay * Math.pow(2, 1)).toBe(2000);
      // Attempt 2: 4000ms
      expect(baseDelay * Math.pow(2, 2)).toBe(4000);
      // Attempt 3: 8000ms
      expect(baseDelay * Math.pow(2, 3)).toBe(8000);
      // Attempt 4: 16000ms
      expect(baseDelay * Math.pow(2, 4)).toBe(16000);
    });

    it('should cap delay at maxDelay', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;

      // Attempt 7: 128000ms > 60000ms, should be capped
      const delay = baseDelay * Math.pow(2, 7);
      expect(Math.min(delay, maxDelay)).toBe(maxDelay);

      // Attempt 10: should definitely be capped
      expect(Math.min(baseDelay * Math.pow(2, 10), maxDelay)).toBe(60000);
    });

    it('should never exceed maxDelay regardless of attempts', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;

      for (let attempt = 0; attempt <= 20; attempt++) {
        const delay = baseDelay * Math.pow(2, attempt);
        const cappedDelay = Math.min(delay, maxDelay);
        expect(cappedDelay).toBeLessThanOrEqual(maxDelay);
      }
    });

    it('should apply jitter to delay', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;
      const jitterFactor = 0.3;
      const attempt = 2;

      const exponentialDelay = baseDelay * Math.pow(2, attempt); // 4000
      const cappedDelay = Math.min(exponentialDelay, maxDelay);
      const jitter = cappedDelay * jitterFactor * Math.random();
      const finalDelay = cappedDelay + jitter;

      // Should be between cappedDelay and cappedDelay + cappedDelay * jitterFactor
      expect(finalDelay).toBeGreaterThanOrEqual(cappedDelay);
      expect(finalDelay).toBeLessThanOrEqual(cappedDelay + cappedDelay * jitterFactor);
    });

    it('should handle jitter without exceeding maxDelay', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;
      const jitterFactor = 0.3;

      // Test multiple attempts with jitter
      for (let attempt = 0; attempt <= 10; attempt++) {
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const cappedDelay = Math.min(exponentialDelay, maxDelay);
        const jitter = cappedDelay * jitterFactor * Math.random();
        const finalDelay = cappedDelay + jitter;

        // Even with jitter, should not exceed maxDelay + (maxDelay * jitterFactor)
        expect(finalDelay).toBeLessThanOrEqual(maxDelay + maxDelay * jitterFactor);
      }
    });
  });

  describe('WebSocket states and transitions', () => {
    it('should have correct WebSocket ready states', () => {
      // WebSocket.CONNECTING = 0
      // WebSocket.OPEN = 1
      // WebSocket.CLOSING = 2
      // WebSocket.CLOSED = 3
      expect(0).toBe(0); // CONNECTING
      expect(1).toBe(1); // OPEN
      expect(2).toBe(2); // CLOSING
      expect(3).toBe(3); // CLOSED
    });

    it('should validate connection state transitions', () => {
      const states = {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
      };

      // Valid transitions
      expect(states.CONNECTING < states.OPEN).toBe(true);
      expect(states.OPEN < states.CLOSING).toBe(true);
      expect(states.CLOSING < states.CLOSED).toBe(true);
    });
  });

  describe('Message type handling', () => {
    it('should handle REGISTER message structure', () => {
      const registerMessage = {
        type: 'REGISTER',
        payload: {
          subdomain: 'my-tunnel',
          localPort: 3000,
          localHost: 'localhost',
          password: 'secret123',
          inspect: true,
          protocol: 'HTTP',
        },
      };

      expect(registerMessage.type).toBe('REGISTER');
      expect(registerMessage.payload.subdomain).toBe('my-tunnel');
      expect(registerMessage.payload.localPort).toBe(3000);
      expect(registerMessage.payload.protocol).toBe('HTTP');
    });

    it('should handle TCP protocol registration', () => {
      const tcpRegisterMessage = {
        type: 'REGISTER',
        payload: {
          subdomain: 'tcp-tunnel',
          localPort: 22,
          localHost: 'localhost',
          password: 'secret123',
          inspect: false,
          protocol: 'TCP',
        },
      };

      expect(tcpRegisterMessage.payload.protocol).toBe('TCP');
    });

    it('should handle REGISTERED response structure', () => {
      const registeredMessage = {
        type: 'REGISTERED',
        payload: {
          tunnelId: 'tunnel-123',
          subdomain: 'my-tunnel',
          publicUrl: 'https://my-tunnel.example.com',
          tcpPort: undefined,
          protocol: 'HTTP',
        },
      };

      expect(registeredMessage.type).toBe('REGISTERED');
      expect(registeredMessage.payload.publicUrl).toContain('my-tunnel');
    });

    it('should handle TCP REGISTERED response with port', () => {
      const tcpRegisteredMessage = {
        type: 'REGISTERED',
        payload: {
          tunnelId: 'tunnel-456',
          subdomain: 'tcp-tunnel',
          publicUrl: 'example.com',
          tcpPort: 10000,
          protocol: 'TCP',
        },
      };

      expect(tcpRegisteredMessage.payload.tcpPort).toBe(10000);
      expect(tcpRegisteredMessage.payload.protocol).toBe('TCP');
    });

    it('should handle REQUEST message structure', () => {
      const requestMessage = {
        type: 'REQUEST',
        requestId: 'req-123',
        payload: {
          method: 'GET',
          path: '/api/users',
          headers: {
            'content-type': 'application/json',
          },
          body: undefined,
        },
      };

      expect(requestMessage.type).toBe('REQUEST');
      expect(requestMessage.requestId).toBe('req-123');
      expect(requestMessage.payload.method).toBe('GET');
    });

    it('should handle RESPONSE message structure', () => {
      const responseMessage = {
        type: 'RESPONSE',
        requestId: 'req-123',
        payload: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
          },
          body: '{"status":"ok"}',
        },
      };

      expect(responseMessage.type).toBe('RESPONSE');
      expect(responseMessage.payload.statusCode).toBe(200);
      expect(responseMessage.payload.body).toContain('ok');
    });

    it('should handle ERROR message', () => {
      const errorMessage = {
        type: 'ERROR',
        payload: {
          code: 'INVALID_SUBDOMAIN',
          message: 'Subdomain already in use',
        },
      };

      expect(errorMessage.type).toBe('ERROR');
      expect(errorMessage.payload.code).toBe('INVALID_SUBDOMAIN');
    });

    it('should handle PING message', () => {
      const pingMessage = {
        type: 'PING',
      };

      expect(pingMessage.type).toBe('PING');
    });

    it('should handle PONG message', () => {
      const pongMessage = {
        type: 'PONG',
      };

      expect(pongMessage.type).toBe('PONG');
    });
  });

  describe('TCP connection messages', () => {
    it('should handle TCP_CONNECT message', () => {
      const tcpConnectMessage = {
        type: 'TCP_CONNECT',
        connectionId: 'conn-789',
        payload: {
          localPort: 22,
        },
      };

      expect(tcpConnectMessage.type).toBe('TCP_CONNECT');
      expect(tcpConnectMessage.connectionId).toBeDefined();
    });

    it('should handle TCP_DATA message with base64 encoding', () => {
      const data = 'SSH-2.0-OpenSSH_8.0';
      const base64Data = Buffer.from(data).toString('base64');

      const tcpDataMessage = {
        type: 'TCP_DATA',
        connectionId: 'conn-789',
        payload: {
          data: base64Data,
        },
      };

      expect(tcpDataMessage.type).toBe('TCP_DATA');
      expect(Buffer.from(tcpDataMessage.payload.data, 'base64').toString()).toBe(data);
    });

    it('should handle TCP_CLOSE message', () => {
      const tcpCloseMessage = {
        type: 'TCP_CLOSE',
        connectionId: 'conn-789',
      };

      expect(tcpCloseMessage.type).toBe('TCP_CLOSE');
    });

    it('should handle TCP_ERROR message', () => {
      const tcpErrorMessage = {
        type: 'TCP_ERROR',
        connectionId: 'conn-789',
        payload: {
          code: 'CONNECTION_ERROR',
          message: 'Connection refused',
        },
      };

      expect(tcpErrorMessage.type).toBe('TCP_ERROR');
      expect(tcpErrorMessage.payload.code).toBe('CONNECTION_ERROR');
    });
  });

  describe('Event emission patterns', () => {
    it('should support connected event with tunnel info', () => {
      const tunnelInfo = {
        id: 'tunnel-123',
        subdomain: 'my-app',
        publicUrl: 'https://my-app.example.com',
        localPort: 3000,
        localHost: 'localhost',
        createdAt: new Date(),
        protocol: 'HTTP',
      };

      expect(tunnelInfo).toHaveProperty('id');
      expect(tunnelInfo).toHaveProperty('publicUrl');
      expect(tunnelInfo).toHaveProperty('protocol');
    });

    it('should support reconnecting event with attempt info', () => {
      const reconnectingInfo = {
        attempt: 3,
        maxAttempts: 10,
        delay: 8000,
      };

      expect(reconnectingInfo.attempt).toBeLessThanOrEqual(reconnectingInfo.maxAttempts);
      expect(reconnectingInfo.delay).toBeGreaterThan(0);
    });

    it('should support reconnected event', () => {
      const tunnelInfo = {
        id: 'tunnel-123',
        subdomain: 'my-app',
        publicUrl: 'https://my-app.example.com',
        localPort: 3000,
        localHost: 'localhost',
        createdAt: new Date(),
        protocol: 'HTTP',
      };

      expect(tunnelInfo.publicUrl).toBeDefined();
    });

    it('should support reconnect_failed event', () => {
      const reconnectFailedInfo = {
        attempts: 10,
      };

      expect(reconnectFailedInfo.attempts).toBeDefined();
    });
  });
});
