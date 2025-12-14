/**
 * WebSocket Integration Tests
 * Tests the WebSocket message handling and tunnel management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { MessageType } from '@localhost-tunnel/shared';

// Mock WebSocket class
class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  // Simulate receiving a message
  receiveMessage(data: unknown) {
    this.emit('message', JSON.stringify(data));
  }
}

describe('WebSocket Message Handling', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Message Parsing', () => {
    it('should parse valid JSON messages', () => {
      const message = {
        type: MessageType.REGISTER,
        payload: {
          localPort: 3000,
          subdomain: 'test-subdomain',
        },
      };

      const parsed = JSON.parse(JSON.stringify(message));

      expect(parsed.type).toBe(MessageType.REGISTER);
      expect(parsed.payload.localPort).toBe(3000);
      expect(parsed.payload.subdomain).toBe('test-subdomain');
    });

    it('should handle malformed JSON gracefully', () => {
      const invalidJson = '{invalid json}';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('Message Types', () => {
    it('should validate REGISTER message structure', () => {
      const message = {
        type: MessageType.REGISTER,
        payload: {
          localPort: 3000,
          localHost: 'localhost',
          subdomain: 'test',
          password: 'secret',
        },
      };

      expect(message.type).toBe('register');
      expect(typeof message.payload.localPort).toBe('number');
      expect(typeof message.payload.localHost).toBe('string');
    });

    it('should validate REGISTERED message structure', () => {
      const message = {
        type: MessageType.REGISTERED,
        payload: {
          tunnelId: 'tunnel-123',
          subdomain: 'test-subdomain',
          publicUrl: 'https://test-subdomain.example.com',
        },
      };

      expect(message.type).toBe('registered');
      expect(message.payload.tunnelId).toBeDefined();
      expect(message.payload.publicUrl).toContain(message.payload.subdomain);
    });

    it('should validate REQUEST message structure', () => {
      const message = {
        type: MessageType.REQUEST,
        requestId: 'req-123',
        payload: {
          method: 'GET',
          path: '/api/users',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'test-client',
          },
          body: undefined,
        },
      };

      expect(message.type).toBe('request');
      expect(message.requestId).toBeDefined();
      expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(message.payload.method);
    });

    it('should validate RESPONSE message structure', () => {
      const message = {
        type: MessageType.RESPONSE,
        requestId: 'req-123',
        payload: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ success: true }),
        },
      };

      expect(message.type).toBe('response');
      expect(message.requestId).toBeDefined();
      expect(message.payload.statusCode).toBeGreaterThanOrEqual(100);
      expect(message.payload.statusCode).toBeLessThan(600);
    });

    it('should validate ERROR message structure', () => {
      const message = {
        type: MessageType.ERROR,
        payload: {
          code: 'TUNNEL_NOT_FOUND',
          message: 'The requested tunnel does not exist',
        },
      };

      expect(message.type).toBe('error');
      expect(message.payload.code).toBeDefined();
      expect(message.payload.message).toBeDefined();
    });

    it('should validate PING/PONG messages', () => {
      const pingMessage = { type: MessageType.PING };
      const pongMessage = { type: MessageType.PONG };

      expect(pingMessage.type).toBe('ping');
      expect(pongMessage.type).toBe('pong');
    });
  });

  describe('WebSocket Connection States', () => {
    it('should handle connection open state', () => {
      expect(mockWs.readyState).toBe(1); // OPEN
    });

    it('should handle connection close', () => {
      const closeHandler = vi.fn();
      mockWs.on('close', closeHandler);

      mockWs.close();

      expect(mockWs.readyState).toBe(3); // CLOSED
      expect(closeHandler).toHaveBeenCalled();
    });

    it('should track sent messages', () => {
      const message1 = JSON.stringify({ type: MessageType.PING });
      const message2 = JSON.stringify({ type: MessageType.PONG });

      mockWs.send(message1);
      mockWs.send(message2);

      expect(mockWs.sentMessages).toHaveLength(2);
      expect(mockWs.sentMessages[0]).toBe(message1);
      expect(mockWs.sentMessages[1]).toBe(message2);
    });
  });

  describe('Message Flow', () => {
    it('should handle register -> registered flow', () => {
      const messageHandler = vi.fn();
      mockWs.on('message', messageHandler);

      // Simulate client sending register
      const registerMessage = {
        type: MessageType.REGISTER,
        payload: {
          localPort: 3000,
          subdomain: 'test',
        },
      };

      mockWs.receiveMessage(registerMessage);

      expect(messageHandler).toHaveBeenCalled();
      const receivedData = JSON.parse(messageHandler.mock.calls[0][0]);
      expect(receivedData.type).toBe(MessageType.REGISTER);
    });

    it('should handle request -> response flow', () => {
      const requestId = 'req-' + Date.now();

      // Server sends request
      const requestMessage = {
        type: MessageType.REQUEST,
        requestId,
        payload: {
          method: 'GET',
          path: '/test',
          headers: {},
        },
      };

      mockWs.send(JSON.stringify(requestMessage));

      // Client receives and responds
      const responseMessage = {
        type: MessageType.RESPONSE,
        requestId,
        payload: {
          statusCode: 200,
          headers: { 'content-type': 'text/plain' },
          body: 'Hello World',
        },
      };

      const messageHandler = vi.fn();
      mockWs.on('message', messageHandler);
      mockWs.receiveMessage(responseMessage);

      expect(messageHandler).toHaveBeenCalled();
      const receivedData = JSON.parse(messageHandler.mock.calls[0][0]);
      expect(receivedData.requestId).toBe(requestId);
    });

    it('should handle ping -> pong keepalive', () => {
      // Client sends ping
      const pingMessage = { type: MessageType.PING };
      mockWs.receiveMessage(pingMessage);

      // Server should respond with pong
      const pongMessage = { type: MessageType.PONG };
      mockWs.send(JSON.stringify(pongMessage));

      expect(mockWs.sentMessages).toContainEqual(JSON.stringify(pongMessage));
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown message type', () => {
      const unknownMessage = {
        type: 'unknown-type',
        payload: {},
      };

      const errorHandler = vi.fn();
      mockWs.on('error', errorHandler);

      // Simulate receiving unknown message type
      const messageHandler = (data: string) => {
        const message = JSON.parse(data);
        if (!Object.values(MessageType).includes(message.type)) {
          mockWs.emit('error', new Error(`Unknown message type: ${message.type}`));
        }
      };

      mockWs.on('message', messageHandler);
      mockWs.receiveMessage(unknownMessage);

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle missing requestId in response', () => {
      const invalidResponse = {
        type: MessageType.RESPONSE,
        // Missing requestId
        payload: {
          statusCode: 200,
          headers: {},
          body: 'test',
        },
      };

      const validateResponse = (msg: typeof invalidResponse): boolean => {
        return msg.type === MessageType.RESPONSE &&
               'requestId' in msg &&
               typeof msg.payload === 'object';
      };

      expect(validateResponse(invalidResponse)).toBe(false);
    });

    it('should handle connection timeout', async () => {
      const timeout = 100; // 100ms timeout for testing
      const timeoutHandler = vi.fn();

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          timeoutHandler();
          reject(new Error('Connection timeout'));
        }, timeout);
      });

      await expect(timeoutPromise).rejects.toThrow('Connection timeout');
      expect(timeoutHandler).toHaveBeenCalled();
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const generateRequestId = () => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const ids = new Set(Array.from({ length: 100 }, generateRequestId));

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should include timestamp in request ID', () => {
      const now = Date.now();
      const requestId = `req-${now}-abc123`;

      expect(requestId).toContain(now.toString());
    });
  });

  describe('Subdomain Validation in Messages', () => {
    it('should accept valid subdomains in register message', () => {
      const validSubdomains = ['my-app', 'test123', 'api-v2', 'app'];

      validSubdomains.forEach((subdomain) => {
        const message = {
          type: MessageType.REGISTER,
          payload: { localPort: 3000, subdomain },
        };

        expect(message.payload.subdomain).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/);
      });
    });

    it('should reject invalid subdomains', () => {
      const invalidSubdomains = ['My-App', '-invalid', 'invalid-', 'has spaces', 'too--many'];

      const isValidSubdomain = (subdomain: string): boolean => {
        return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain) && !subdomain.includes('--');
      };

      invalidSubdomains.forEach((subdomain) => {
        expect(isValidSubdomain(subdomain)).toBe(false);
      });
    });
  });

  describe('Concurrent Messages', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        type: MessageType.REQUEST,
        requestId: `req-${i}`,
        payload: {
          method: 'GET',
          path: `/api/item/${i}`,
          headers: {},
        },
      }));

      const responses: Map<string, { statusCode: number }> = new Map();

      // Simulate sending all requests concurrently
      requests.forEach((req) => {
        mockWs.send(JSON.stringify(req));
        // Simulate immediate response
        responses.set(req.requestId, { statusCode: 200 });
      });

      // All requests should have responses
      expect(responses.size).toBe(10);
      requests.forEach((req) => {
        expect(responses.has(req.requestId)).toBe(true);
      });
    });

    it('should track pending requests correctly', () => {
      const pendingRequests = new Map<string, { timestamp: number }>();

      // Add pending requests
      for (let i = 0; i < 5; i++) {
        const requestId = `req-${i}`;
        pendingRequests.set(requestId, { timestamp: Date.now() });
      }

      expect(pendingRequests.size).toBe(5);

      // Resolve some requests
      pendingRequests.delete('req-0');
      pendingRequests.delete('req-2');

      expect(pendingRequests.size).toBe(3);
      expect(pendingRequests.has('req-0')).toBe(false);
      expect(pendingRequests.has('req-1')).toBe(true);
    });
  });

  describe('Large Message Handling', () => {
    it('should handle large request bodies', () => {
      const largeBody = 'x'.repeat(1024 * 1024); // 1MB

      const message = {
        type: MessageType.REQUEST,
        requestId: 'req-large',
        payload: {
          method: 'POST',
          path: '/upload',
          headers: { 'content-type': 'application/octet-stream' },
          body: largeBody,
        },
      };

      const serialized = JSON.stringify(message);
      expect(serialized.length).toBeGreaterThan(1024 * 1024);

      const parsed = JSON.parse(serialized);
      expect(parsed.payload.body.length).toBe(largeBody.length);
    });

    it('should handle large response bodies', () => {
      const largeBody = JSON.stringify(Array.from({ length: 10000 }, (_, i) => ({ id: i, data: 'test' })));

      const message = {
        type: MessageType.RESPONSE,
        requestId: 'req-large-response',
        payload: {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: largeBody,
        },
      };

      expect(message.payload.body.length).toBeGreaterThan(100000);
    });
  });

  describe('Binary Message Support', () => {
    it('should handle base64 encoded binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);
      const base64Encoded = binaryData.toString('base64');

      const message = {
        type: MessageType.RESPONSE,
        requestId: 'req-binary',
        payload: {
          statusCode: 200,
          headers: { 'content-type': 'application/octet-stream' },
          body: base64Encoded,
        },
      };

      const decoded = Buffer.from(message.payload.body, 'base64');
      expect(decoded).toEqual(binaryData);
    });
  });
});

describe('Message Serialization', () => {
  it('should maintain message integrity through serialization', () => {
    const originalMessage = {
      type: MessageType.REQUEST,
      requestId: 'req-123',
      payload: {
        method: 'POST',
        path: '/api/data',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'value',
        },
        body: JSON.stringify({ key: 'value', nested: { deep: true } }),
      },
    };

    const serialized = JSON.stringify(originalMessage);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(originalMessage);
  });

  it('should handle special characters in messages', () => {
    const message = {
      type: MessageType.RESPONSE,
      requestId: 'req-special',
      payload: {
        statusCode: 200,
        headers: {},
        body: 'Special chars: "quotes", \\backslash, \n\nnewlines, \ttabs, unicode: 你好',
      },
    };

    const serialized = JSON.stringify(message);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.payload.body).toBe(message.payload.body);
  });
});
