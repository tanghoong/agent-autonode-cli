import chalk from 'chalk';
import { loadConfig } from '../utils/config';
import { buildRegistry } from '../utils/registry';

export function registerPluginsCommand(program: import('commander').Command): void {
  const plugins = program.command('plugins').description('Inspect connectors and configured plugins');

  plugins
    .command('list')
    .description('List available connectors and configured plugins')
    .action(async () => {
      const config = loadConfig();
      const registry = await buildRegistry();

      console.log(chalk.bold('Connectors:'));
      for (const type of [...registry.keys()].sort()) {
        console.log('  ' + chalk.cyan(type));
      }
      console.log('');

      if (config.path) {
        console.log(chalk.dim(`Config: ${config.path}`));
      } else {
        console.log(chalk.dim('No autonode.config.json found — using defaults.'));
      }

      if (config.plugins.length > 0) {
        console.log(chalk.bold('Configured plugins:'));
        for (const plugin of config.plugins) {
          console.log('  ' + chalk.yellow(plugin));
        }
        console.log(chalk.dim('(Plugin loading arrives in a later v0.3 release.)'));
      } else {
        console.log('No plugins configured.');
      }
    });
}
