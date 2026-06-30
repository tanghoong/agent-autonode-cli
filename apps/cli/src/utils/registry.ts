/**
 * Single place every command obtains its connector registry: the built-in
 * connectors plus any connectors contributed by configured plugins.
 *
 * It is async because loading plugins resolves and imports modules.
 */
import { createDefaultRegistry } from '@autonode/connectors';
import type { ConnectorRegistry } from '@autonode/engine';
import { loadConfig, type LoadedConfig } from './config';
import { applyPlugins } from './plugins';

export interface BuildRegistryOptions {
  /** Pre-loaded config; loaded from disk when omitted. */
  config?: LoadedConfig;
  /** Set false to skip plugins and use built-ins only (e.g. `--no-plugins`). */
  plugins?: boolean;
}

export async function buildRegistry(options: BuildRegistryOptions = {}): Promise<ConnectorRegistry> {
  const registry = createDefaultRegistry();
  if (options.plugins === false) return registry;

  const config = options.config ?? loadConfig();
  applyPlugins(registry, config);
  return registry;
}
