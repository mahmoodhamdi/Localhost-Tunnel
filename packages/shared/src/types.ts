// Protocol types
export enum Protocol {
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  TCP = 'TCP',
  WS = 'WS',
}

// Tunnel status
export enum TunnelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  ERROR = 'error',
}

// Tunnel configuration
export interface TunnelConfig {
  id?: string;
  subdomain?: string;
  localPort: number;
  localHost?: string;
  protocol?: Protocol;
  password?: string;
  ipWhitelist?: string[];
  expiresAt?: Date | null;
  inspect?: boolean;
}

// Tunnel info returned from server
export interface TunnelInfo {
  id: string;
  subdomain: string;
  publicUrl: string;
  localPort: number;
  localHost: string;
  protocol: Protocol;
  status: TunnelStatus;
  hasPassword: boolean;
  ipWhitelist: string[];
  expiresAt: Date | null;
  inspect: boolean;
  totalRequests: number;
  totalBytes: number;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

// Request log entry
export interface RequestLog {
  id: string;
  tunnelId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query?: string;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTime?: number;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

// Analytics data
export interface TunnelAnalytics {
  tunnelId: string;
  totalRequests: number;
  uniqueIps: number;
  bandwidth: number;
  avgResponseTime: number;
  successRate: number;
  errorRate: number;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  requestsOverTime: Array<{
    timestamp: Date;
    count: number;
  }>;
  topPaths: Array<{
    path: string;
    count: number;
  }>;
}

// Settings
export interface Settings {
  maxTunnels: number;
  maxRequests: number;
  tunnelTimeout: number;
  rateLimit: number;
  defaultPort: number;
  autoReconnect: boolean;
  keepHistoryDays: number;
}

// WebSocket message types
export enum MessageType {
  // Client -> Server
  REGISTER = 'register',
  RESPONSE = 'response',
  PING = 'ping',

  // Server -> Client
  REGISTERED = 'registered',
  REQUEST = 'request',
  ERROR = 'error',
  PONG = 'pong',

  // TCP-specific messages
  TCP_CONNECT = 'tcp_connect',
  TCP_DATA = 'tcp_data',
  TCP_CLOSE = 'tcp_close',
  TCP_ERROR = 'tcp_error',
}

// WebSocket messages
export interface WSMessage {
  type: MessageType;
  payload?: unknown;
  requestId?: string;
}

export interface RegisterMessage extends WSMessage {
  type: MessageType.REGISTER;
  payload: {
    subdomain?: string;
    localPort: number;
    localHost?: string;
    password?: string;
    protocol?: Protocol;
  };
}

export interface RegisteredMessage extends WSMessage {
  type: MessageType.REGISTERED;
  payload: {
    tunnelId: string;
    subdomain: string;
    publicUrl: string;
    tcpPort?: number; // For TCP tunnels
    protocol: Protocol;
  };
}

export interface RequestMessage extends WSMessage {
  type: MessageType.REQUEST;
  requestId: string;
  payload: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
  };
}

export interface ResponseMessage extends WSMessage {
  type: MessageType.RESPONSE;
  requestId: string;
  payload: {
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
  };
}

export interface ErrorMessage extends WSMessage {
  type: MessageType.ERROR;
  payload: {
    code: string;
    message: string;
  };
}

// TCP-specific messages
export interface TcpConnectMessage extends WSMessage {
  type: MessageType.TCP_CONNECT;
  connectionId: string;
  payload: {
    remoteAddress: string;
    remotePort: number;
    localPort: number;
  };
}

export interface TcpDataMessage extends WSMessage {
  type: MessageType.TCP_DATA;
  connectionId: string;
  payload: {
    data: string; // Base64 encoded
  };
}

export interface TcpCloseMessage extends WSMessage {
  type: MessageType.TCP_CLOSE;
  connectionId: string;
}

export interface TcpErrorMessage extends WSMessage {
  type: MessageType.TCP_ERROR;
  connectionId: string;
  payload: {
    code: string;
    message: string;
  };
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Health check response
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  tunnels: {
    active: number;
    total: number;
  };
}
