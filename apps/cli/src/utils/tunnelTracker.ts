import Conf from 'conf';

interface ActiveTunnel {
  pid: number;
  subdomain: string;
  publicUrl: string;
  localPort: number;
  localHost: string;
  startedAt: string;
}

interface TunnelTrackerStore {
  tunnels: ActiveTunnel[];
}

const tracker = new Conf<TunnelTrackerStore>({
  projectName: 'localhost-tunnel-active',
  defaults: {
    tunnels: [],
  },
});

/**
 * Register a new active tunnel
 */
export function registerTunnel(tunnel: Omit<ActiveTunnel, 'pid' | 'startedAt'>): void {
  const tunnels = tracker.get('tunnels');
  const newTunnel: ActiveTunnel = {
    ...tunnel,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };

  // Remove any stale tunnels from this process (if restarting)
  const filtered = tunnels.filter((t) => t.pid !== process.pid);
  filtered.push(newTunnel);

  tracker.set('tunnels', filtered);
}

/**
 * Unregister tunnel when closing
 */
export function unregisterTunnel(): void {
  const tunnels = tracker.get('tunnels');
  const filtered = tunnels.filter((t) => t.pid !== process.pid);
  tracker.set('tunnels', filtered);
}

/**
 * Get all active tunnels, filtering out stale processes
 */
export function getActiveTunnels(): ActiveTunnel[] {
  const tunnels = tracker.get('tunnels');

  // Filter out tunnels from dead processes
  const activeTunnels = tunnels.filter((tunnel) => {
    try {
      // Check if process is still running
      process.kill(tunnel.pid, 0);
      return true;
    } catch {
      // Process not running
      return false;
    }
  });

  // Clean up stale entries
  if (activeTunnels.length !== tunnels.length) {
    tracker.set('tunnels', activeTunnels);
  }

  return activeTunnels;
}

/**
 * Clear all tunnel entries (useful for cleanup)
 */
export function clearAllTunnels(): void {
  tracker.set('tunnels', []);
}

export type { ActiveTunnel };
