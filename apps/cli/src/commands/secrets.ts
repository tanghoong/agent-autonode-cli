import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

const SECRETS_DIR = path.join(os.homedir(), '.taskpipe');
const SECRETS_FILE = path.join(SECRETS_DIR, 'secrets.json');

function loadSecrets(): Record<string, string> {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveSecrets(secrets: Record<string, string>): void {
  if (!fs.existsSync(SECRETS_DIR)) {
    fs.mkdirSync(SECRETS_DIR, { recursive: true });
  }
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2));
}

export function registerSecretsCommand(program: import('commander').Command): void {
  const secrets = program.command('secrets').description('Manage secrets');

  secrets
    .command('set <key> <value>')
    .description('Set a secret')
    .action((key: string, value: string) => {
      const data = loadSecrets();
      data[key] = value;
      saveSecrets(data);
      console.log(chalk.green('✓') + ` Secret '${key}' saved`);
    });

  secrets
    .command('list')
    .description('List all secrets')
    .action(() => {
      const data = loadSecrets();
      const keys = Object.keys(data);
      if (keys.length === 0) {
        console.log('No secrets found.');
        return;
      }
      console.log(chalk.bold('Secrets:'));
      for (const key of keys) {
        console.log(`  ${key}: ${chalk.dim('****')}`);
      }
    });

  secrets
    .command('remove <key>')
    .description('Remove a secret')
    .action((key: string) => {
      const data = loadSecrets();
      if (!(key in data)) {
        console.log(chalk.yellow(`Secret '${key}' not found`));
        return;
      }
      delete data[key];
      saveSecrets(data);
      console.log(chalk.green('✓') + ` Secret '${key}' removed`);
    });
}
