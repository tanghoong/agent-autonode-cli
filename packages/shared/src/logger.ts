export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function timestamp(): string {
  return colorize('dim', new Date().toISOString());
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    console.debug(`${timestamp()} ${colorize('cyan', '[DEBUG]')} ${message}`, ...args);
  },
  info(message: string, ...args: unknown[]): void {
    console.info(`${timestamp()} ${colorize('blue', '[INFO]')} ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`${timestamp()} ${colorize('yellow', '[WARN]')} ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(`${timestamp()} ${colorize('red', '[ERROR]')} ${message}`, ...args);
  },
  success(message: string, ...args: unknown[]): void {
    console.info(`${timestamp()} ${colorize('green', '[SUCCESS]')} ${message}`, ...args);
  },
};
