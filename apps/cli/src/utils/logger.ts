import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },
  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },
  warning: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },
  error: (message: string) => {
    console.log(chalk.red('✗'), message);
  },
  url: (url: string) => {
    console.log(chalk.cyan.underline(url));
  },
  blank: () => {
    console.log();
  },
  header: (text: string) => {
    console.log(chalk.bold.white(text));
  },
  dim: (text: string) => {
    console.log(chalk.dim(text));
  },
};
