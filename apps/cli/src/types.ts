export interface TunnelOptions {
  port: number;
  host?: string;
  subdomain?: string;
  password?: string;
  tcp?: boolean;
  inspect?: boolean;
  server?: string;
  // TLS options
  insecure?: boolean;  // Skip certificate verification (not recommended)
  ca?: string;         // Path to custom CA certificate
}

export interface TunnelConfig {
  server: string;
  defaultPort: number;
  autoReconnect: boolean;
}

export interface ActiveTunnel {
  id: string;
  subdomain: string;
  publicUrl: string;
  localPort: number;
  localHost: string;
  createdAt: Date;
}
