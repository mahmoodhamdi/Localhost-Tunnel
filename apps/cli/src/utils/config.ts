import Conf from 'conf';
import type { TunnelConfig } from '../types.js';

const config = new Conf<TunnelConfig>({
  projectName: 'localhost-tunnel',
  defaults: {
    server: 'http://localhost:7000',
    defaultPort: 3000,
    autoReconnect: true,
  },
});

export function getConfig(): TunnelConfig {
  return {
    server: config.get('server'),
    defaultPort: config.get('defaultPort'),
    autoReconnect: config.get('autoReconnect'),
  };
}

export function setConfig(key: keyof TunnelConfig, value: string | number | boolean): void {
  config.set(key, value);
}

export function resetConfig(): void {
  config.clear();
}

export { config };
