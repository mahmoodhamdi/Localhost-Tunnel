export interface TunnelOptions {
  port: number;
  host?: string;
  subdomain?: string;
  password?: string;
  tcp?: boolean;
  inspect?: boolean;
  server?: string;
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
