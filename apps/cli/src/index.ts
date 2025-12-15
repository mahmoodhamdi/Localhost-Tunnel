#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import readline from 'readline';
import { TunnelAgent } from './client/agent.js';
import { getConfig, setConfig, resetConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

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

    try {
      const tunnel = await agent.connect();
      spinner.succeed('Connected!');

      logger.blank();
      logger.header('Tunnel established');
      logger.blank();
      logger.info(`Forwarding: ${chalk.cyan(tunnel.publicUrl)} -> ${chalk.yellow(`http://${options.host}:${port}`)}`);
      logger.blank();
      logger.dim('Press Ctrl+C to stop the tunnel');
      logger.blank();

      // Keep-alive ping
      const pingInterval = setInterval(() => {
        agent.ping();
      }, 30000);

      // Handle process termination
      process.on('SIGINT', () => {
        clearInterval(pingInterval);
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
    logger.info('No active tunnels');
  });

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
