#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import readline from 'readline';
import { TunnelAgent } from './client/agent.js';
import { getConfig, setConfig, resetConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { registerTunnel, unregisterTunnel, getActiveTunnels } from './utils/tunnelTracker.js';

const program = new Command();

/**
 * Securely prompt for password without showing it in process list
 * Password can be provided via:
 * 1. LT_PASSWORD environment variable (recommended for scripts)
 * 2. Interactive prompt with --password flag (no value)
 * 3. Direct value (not recommended - visible in process list)
 */
async function getPassword(passwordOption: string | boolean | undefined): Promise<string | undefined> {
  // Check environment variable first (most secure for scripts)
  if (process.env.LT_PASSWORD) {
    return process.env.LT_PASSWORD;
  }

  // If --password flag used without value, prompt interactively
  if (passwordOption === true) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Disable echo for password input
      if (process.stdin.isTTY) {
        process.stdout.write('Enter tunnel password: ');
        process.stdin.setRawMode(true);

        let password = '';
        process.stdin.on('data', (char) => {
          const c = char.toString();
          if (c === '\n' || c === '\r') {
            process.stdin.setRawMode(false);
            console.log(); // New line after password
            rl.close();
            resolve(password);
          } else if (c === '\u0003') {
            // Ctrl+C
            process.exit(0);
          } else if (c === '\u007F' || c === '\b') {
            // Backspace
            password = password.slice(0, -1);
          } else {
            password += c;
          }
        });
      } else {
        // Non-TTY: read line normally
        rl.question('Enter tunnel password: ', (answer) => {
          rl.close();
          resolve(answer);
        });
      }
    });
  }

  // Direct value provided (legacy support, but warn user)
  if (typeof passwordOption === 'string' && passwordOption.length > 0) {
    logger.warning('Warning: Password visible in process list. Use LT_PASSWORD env var or --password (interactive) instead.');
    return passwordOption;
  }

  return undefined;
}

program
  .name('lt')
  .description('Expose localhost to the internet')
  .version('1.0.0');

program
  .option('-p, --port <port>', 'Local port to expose', '3000')
  .option('-h, --host <host>', 'Local host', 'localhost')
  .option('-s, --subdomain <subdomain>', 'Request a specific subdomain')
  .option('--password [password]', 'Protect tunnel with password (use without value for interactive prompt, or set LT_PASSWORD env var)')
  .option('--tcp', 'Create TCP tunnel instead of HTTP')
  .option('--server <url>', 'Tunnel server URL')
  .option('--inspect', 'Enable request inspection')
  .option('--insecure', 'Skip TLS certificate verification (not recommended)')
  .option('--ca <path>', 'Path to custom CA certificate for TLS verification')
  .action(async (options) => {
    const config = getConfig();
    const serverUrl = options.server || config.server;
    const port = parseInt(options.port, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      logger.error('Invalid port number');
      process.exit(1);
    }

    // Get password securely (from env var, interactive prompt, or direct value)
    const password = await getPassword(options.password);

    const spinner = ora('Connecting to tunnel server...').start();

    const agent = new TunnelAgent(
      {
        port,
        host: options.host,
        subdomain: options.subdomain,
        password,
        tcp: options.tcp,
        inspect: options.inspect,
        insecure: options.insecure,
        ca: options.ca,
      },
      serverUrl,
    );

    agent.on('request', ({ method, path, statusCode }) => {
      const statusColor = statusCode < 400 ? 'green' : 'red';
      console.log(
        chalk.gray(new Date().toLocaleTimeString()),
        chalk.bold(method.padEnd(6)),
        path,
        chalk[statusColor](statusCode),
      );
    });

    // Handle reconnection events
    agent.on('disconnected', () => {
      logger.blank();
      logger.warning('Connection to tunnel server lost.');
    });

    agent.on('reconnecting', ({ attempt, maxAttempts }: { attempt: number; maxAttempts: number }) => {
      logger.dim(`Reconnection attempt ${attempt}/${maxAttempts}...`);
    });

    agent.on('reconnected', (tunnel) => {
      logger.blank();
      logger.success('Reconnected to tunnel server!');
      if (tunnel) {
        // Update tunnel tracker with new info (subdomain might have changed)
        registerTunnel({
          subdomain: tunnel.subdomain,
          publicUrl: tunnel.publicUrl,
          localPort: port,
          localHost: options.host,
        });
        logger.info(`Tunnel: ${chalk.cyan(tunnel.publicUrl)} -> ${chalk.yellow(`http://${options.host}:${port}`)}`);
      }
      logger.blank();
    });

    agent.on('reconnect_failed', ({ attempts }: { attempts: number }) => {
      logger.blank();
      logger.error(`Failed to reconnect after ${attempts} attempts. Exiting.`);
      unregisterTunnel();
      process.exit(1);
    });

    try {
      const tunnel = await agent.connect();
      spinner.succeed('Connected!');

      // Register tunnel for status command
      registerTunnel({
        subdomain: tunnel.subdomain,
        publicUrl: tunnel.publicUrl,
        localPort: port,
        localHost: options.host,
      });

      logger.blank();
      logger.header('Tunnel established');
      logger.blank();
      logger.info(`Forwarding: ${chalk.cyan(tunnel.publicUrl)} -> ${chalk.yellow(`http://${options.host}:${port}`)}`);
      logger.blank();
      logger.dim('Press Ctrl+C to stop the tunnel');
      logger.blank();

      // Note: Heartbeat is now handled internally by TunnelAgent

      // Handle process termination
      process.on('SIGINT', () => {
        unregisterTunnel();
        spinner.start('Closing tunnel...');
        agent.close();
        spinner.succeed('Tunnel closed');
        process.exit(0);
      });
    } catch (error) {
      spinner.fail('Failed to connect');
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show active tunnels')
  .action(() => {
    const tunnels = getActiveTunnels();

    if (tunnels.length === 0) {
      logger.info('No active tunnels');
      return;
    }

    logger.header(`Active Tunnels (${tunnels.length})`);
    logger.blank();

    tunnels.forEach((tunnel, index) => {
      const startedAt = new Date(tunnel.startedAt);
      const uptime = formatUptime(Date.now() - startedAt.getTime());

      logger.info(`${chalk.bold(`#${index + 1}`)} ${chalk.cyan(tunnel.subdomain)}`);
      logger.info(`   Public URL: ${chalk.green(tunnel.publicUrl)}`);
      logger.info(`   Local:      ${chalk.yellow(`http://${tunnel.localHost}:${tunnel.localPort}`)}`);
      logger.info(`   PID:        ${tunnel.pid}`);
      logger.info(`   Uptime:     ${uptime}`);
      logger.blank();
    });
  });

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

program
  .command('config')
  .description('Configure default settings')
  .option('--server <url>', 'Set default server URL')
  .option('--port <port>', 'Set default port')
  .option('--reset', 'Reset to defaults')
  .action((options) => {
    if (options.reset) {
      resetConfig();
      logger.success('Configuration reset to defaults');
      return;
    }

    if (options.server) {
      setConfig('server', options.server);
      logger.success(`Server set to: ${options.server}`);
    }

    if (options.port) {
      setConfig('defaultPort', parseInt(options.port, 10));
      logger.success(`Default port set to: ${options.port}`);
    }

    if (!options.server && !options.port) {
      const config = getConfig();
      logger.header('Current configuration:');
      logger.info(`Server: ${config.server}`);
      logger.info(`Default port: ${config.defaultPort}`);
      logger.info(`Auto reconnect: ${config.autoReconnect}`);
    }
  });

program.parse();
