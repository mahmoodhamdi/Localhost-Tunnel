#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { TunnelAgent } from './client/agent.js';
import { getConfig, setConfig, resetConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('lt')
  .description('Expose localhost to the internet')
  .version('1.0.0');

program
  .option('-p, --port <port>', 'Local port to expose', '3000')
  .option('-h, --host <host>', 'Local host', 'localhost')
  .option('-s, --subdomain <subdomain>', 'Request a specific subdomain')
  .option('--password <password>', 'Protect tunnel with password')
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

    const spinner = ora('Connecting to tunnel server...').start();

    const agent = new TunnelAgent(
      {
        port,
        host: options.host,
        subdomain: options.subdomain,
        password: options.password,
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
