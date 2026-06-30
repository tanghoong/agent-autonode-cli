import chalk from 'chalk';
import { createDefaultRegistry } from '@autonode/connectors';
import { loadConfig } from '../utils/config';
import { loadPlugins } from '../utils/plugins';

export function registerPluginsCommand(program: import('commander').Command): void {
  const plugins = program.command('plugins').description('Inspect connectors and configured plugins');

  plugins
    .command('list')
    .description('List available connectors and configured plugins')
    .action(() => {
      const config = loadConfig();

      console.log(chalk.bold('Built-in connectors:'));
      for (const type of [...createDefaultRegistry().keys()].sort()) {
        console.log('  ' + chalk.cyan(type));
      }
      console.log('');

      if (config.path) {
        console.log(chalk.dim(`Config: ${config.path}`));
      } else {
        console.log(chalk.dim('No autonode.config.json found — using defaults.'));
      }

      if (config.plugins.length === 0) {
        console.log('No plugins configured.');
        return;
      }

      try {
        const loaded = loadPlugins(config);
        console.log(chalk.bold('Plugins:'));
        for (const plugin of loaded) {
          const types = Object.keys(plugin.connectors).sort();
          console.log('  ' + chalk.yellow(plugin.name) + chalk.dim(` (${plugin.specifier})`));
          for (const type of types) {
            console.log('    ' + chalk.cyan(type));
          }
        }
      } catch (err) {
        console.log(chalk.red('Failed to load plugins: ') + (err as Error).message);
        process.exitCode = 1;
      }
    });
}
