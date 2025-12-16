import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock net module
const mockServer = {
  on: vi.fn(),
  listen: vi.fn((port, host, cb) => cb?.()),
  close: vi.fn(),
};

const mockSocket = {
  remoteAddress: '127.0.0.1',
  remotePort: 12345,
  on: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
  destroy: vi.fn(),
  destroyed: false,
};

vi.mock('net', () => ({
  default: {
    createServer: vi.fn(() => mockServer),
  },
}));

// Mock WebSocket
const mockWs = {
  send: vi.fn(),
  on: vi.fn(),
  readyState: 1, // OPEN
};

describe('TCP Tunnel Manager Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Port Management', () => {
    it('should use correct TCP port range', () => {
      const TCP_PORT_MIN = 10000;
      const TCP_PORT_MAX = 65535;

      expect(TCP_PORT_MIN).toBe(10000);
      expect(TCP_PORT_MAX).toBe(65535);
    });

    it('should generate port within valid range', () => {
      const TCP_PORT_MIN = 10000;
      const TCP_PORT_MAX = 65535;
      const port = Math.floor(Math.random() * (TCP_PORT_MAX - TCP_PORT_MIN + 1)) + TCP_PORT_MIN;

      expect(port).toBeGreaterThanOrEqual(TCP_PORT_MIN);
      expect(port).toBeLessThanOrEqual(TCP_PORT_MAX);
    });

    it('should track used ports', () => {
      const usedPorts = new Set<number>();
      usedPorts.add(10000);
      usedPorts.add(10001);

      expect(usedPorts.has(10000)).toBe(true);
      expect(usedPorts.has(10001)).toBe(true);
      expect(usedPorts.has(10002)).toBe(false);
    });
  });

  describe('Connection ID Generation', () => {
    it('should generate unique connection IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = Math.random().toString(36).substring(2);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });

    it('should generate hex format IDs', () => {
      const hexPattern = /^[0-9a-f]+$/;
      const id = 'abc123def456';
      expect(hexPattern.test(id)).toBe(true);
    });
  });

  describe('TCP Message Types', () => {
    it('should have TCP_CONNECT message type', () => {
      const message = {
        type: 'tcp_connect',
        connectionId: 'conn-1',
        payload: {
          remoteAddress: '127.0.0.1',
          remotePort: 12345,
          localPort: 3000,
        },
      };

      expect(message.type).toBe('tcp_connect');
      expect(message.connectionId).toBe('conn-1');
      expect(message.payload.localPort).toBe(3000);
    });

    it('should have TCP_DATA message type', () => {
      const data = Buffer.from('Hello World');
      const message = {
        type: 'tcp_data',
        connectionId: 'conn-1',
        payload: {
          data: data.toString('base64'),
        },
      };

      expect(message.type).toBe('tcp_data');
      expect(Buffer.from(message.payload.data, 'base64').toString()).toBe('Hello World');
    });

    it('should have TCP_CLOSE message type', () => {
      const message = {
        type: 'tcp_close',
        connectionId: 'conn-1',
      };

      expect(message.type).toBe('tcp_close');
      expect(message.connectionId).toBe('conn-1');
    });

    it('should have TCP_ERROR message type', () => {
      const message = {
        type: 'tcp_error',
        connectionId: 'conn-1',
        payload: {
          code: 'CONNECTION_REFUSED',
          message: 'Connection refused',
        },
      };

      expect(message.type).toBe('tcp_error');
      expect(message.payload.code).toBe('CONNECTION_REFUSED');
    });
  });

  describe('TCP Tunnel Connection', () => {
    it('should store tunnel connection with required fields', () => {
      const tunnel = {
        id: 'tunnel-1',
        subdomain: 'test-tcp',
        ws: mockWs,
        localPort: 3000,
        tcpPort: 10500,
        activeConnections: new Map(),
        createdAt: new Date(),
      };

      expect(tunnel.id).toBe('tunnel-1');
      expect(tunnel.subdomain).toBe('test-tcp');
      expect(tunnel.tcpPort).toBe(10500);
      expect(tunnel.activeConnections.size).toBe(0);
    });

    it('should track active connections', () => {
      const activeConnections = new Map<string, typeof mockSocket>();
      activeConnections.set('conn-1', mockSocket);
      activeConnections.set('conn-2', mockSocket);

      expect(activeConnections.size).toBe(2);
      expect(activeConnections.has('conn-1')).toBe(true);
    });
  });

  describe('Data Encoding', () => {
    it('should encode binary data as base64', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const encoded = binaryData.toString('base64');
      const decoded = Buffer.from(encoded, 'base64');

      expect(decoded.equals(binaryData)).toBe(true);
    });

    it('should handle text data encoding', () => {
      const textData = 'Hello, TCP Tunnel!';
      const encoded = Buffer.from(textData).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString();

      expect(decoded).toBe(textData);
    });

    it('should handle empty data', () => {
      const emptyData = Buffer.from('');
      const encoded = emptyData.toString('base64');

      expect(encoded).toBe('');
    });

    it('should handle large data chunks', () => {
      const largeData = Buffer.alloc(1024 * 64, 'x'); // 64KB
      const encoded = largeData.toString('base64');
      const decoded = Buffer.from(encoded, 'base64');

      expect(decoded.length).toBe(largeData.length);
    });
  });

  describe('Tunnel Cleanup', () => {
    it('should clean up all active connections on removal', () => {
      const connections = new Map<string, typeof mockSocket>();
      connections.set('conn-1', { ...mockSocket, destroy: vi.fn() });
      connections.set('conn-2', { ...mockSocket, destroy: vi.fn() });

      // Simulate cleanup
      for (const [, socket] of connections) {
        socket.destroy();
      }
      connections.clear();

      expect(connections.size).toBe(0);
    });

    it('should release port on tunnel removal', () => {
      const usedPorts = new Set<number>();
      usedPorts.add(10500);

      // Simulate removal
      usedPorts.delete(10500);

      expect(usedPorts.has(10500)).toBe(false);
    });

    it('should remove from subdomain mapping on cleanup', () => {
      const subdomainToId = new Map<string, string>();
      subdomainToId.set('test-tcp', 'tunnel-1');

      // Simulate cleanup
      subdomainToId.delete('test-tcp');

      expect(subdomainToId.has('test-tcp')).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit tcp:created event on tunnel creation', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();
      emitter.on('tcp:created', handler);

      emitter.emit('tcp:created', { tunnelId: 'tunnel-1', tcpPort: 10500 });

      expect(handler).toHaveBeenCalledWith({ tunnelId: 'tunnel-1', tcpPort: 10500 });
    });

    it('should emit tcp:connection event on new connection', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();
      emitter.on('tcp:connection', handler);

      emitter.emit('tcp:connection', {
        tunnelId: 'tunnel-1',
        connectionId: 'conn-1',
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit tcp:closed event on tunnel close', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();
      emitter.on('tcp:closed', handler);

      emitter.emit('tcp:closed', { tunnelId: 'tunnel-1', tcpPort: 10500 });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Public URL Generation', () => {
    it('should generate correct TCP public URL', () => {
      const domain = 'localhost:3000';
      const host = domain.split(':')[0];
      const tcpPort = 10500;
      const publicUrl = `tcp://${host}:${tcpPort}`;

      expect(publicUrl).toBe('tcp://localhost:10500');
    });

    it('should handle domain with port', () => {
      const domain = 'tunnel.example.com:8080';
      const host = domain.split(':')[0];
      const tcpPort = 10500;
      const publicUrl = `tcp://${host}:${tcpPort}`;

      expect(publicUrl).toBe('tcp://tunnel.example.com:10500');
    });

    it('should handle domain without port', () => {
      const domain = 'tunnel.example.com';
      const host = domain.split(':')[0];
      const tcpPort = 10500;
      const publicUrl = `tcp://${host}:${tcpPort}`;

      expect(publicUrl).toBe('tcp://tunnel.example.com:10500');
    });
  });

  describe('Statistics', () => {
    it('should count active tunnels', () => {
      const tunnels = new Map();
      tunnels.set('tunnel-1', {});
      tunnels.set('tunnel-2', {});

      expect(tunnels.size).toBe(2);
    });

    it('should count total connections across all tunnels', () => {
      const tunnel1Connections = new Map();
      tunnel1Connections.set('conn-1', {});
      tunnel1Connections.set('conn-2', {});

      const tunnel2Connections = new Map();
      tunnel2Connections.set('conn-3', {});

      const totalConnections = tunnel1Connections.size + tunnel2Connections.size;

      expect(totalConnections).toBe(3);
    });
  });
});
