/**
 * Loads connectors contributed by configured plugins.
 *
 * A plugin is a module referenced from `autonode.config.json` (`plugins: [...]`)
 * — either an installed package name or a path relative to the project root
 * (the directory containing the config file, or the cwd when none is found).
 *
 * SECURITY: loading a plugin executes its module code (and its activator). Only
 * list plugins you trust. Use `--no-plugins` to run with built-ins only.
 */
import { createRequire } from 'module';
import * as path from 'path';
import type { AutonodePlugin, ConnectorFn } from '@autonode/shared';
import type { ConnectorRegistry } from '@autonode/engine';
import type { LoadedConfig } from './config';

export interface LoadedPlugin {
  /** The plugin's declared name. */
  name: string;
  /** The specifier it was loaded from (package name or path). */
  specifier: string;
  /** Connectors it contributes, keyed by step `type`. */
  connectors: Record<string, ConnectorFn>;
}

function projectRootOf(config: LoadedConfig): string {
  return config.path ? path.dirname(config.path) : process.cwd();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** Loads and validates a single plugin module. Throws on resolution or shape errors. */
function loadOne(specifier: string, projectRoot: string): LoadedPlugin {
  // Resolve specifiers against the project root so package names come from the
  // project's node_modules and relative paths are relative to the project.
  const require = createRequire(path.join(projectRoot, 'package.json'));

  let mod: unknown;
  try {
    mod = require(require.resolve(specifier));
  } catch (err) {
    throw new Error(`Failed to load plugin '${specifier}': ${(err as Error).message}`);
  }

  // Accept `export default` (interop sets `.default`) or `module.exports = ...`.
  const exported = isRecord(mod) && 'default' in mod ? (mod as { default: unknown }).default : mod;
  const plugin = (typeof exported === 'function' ? exported() : exported) as AutonodePlugin;

  if (!isRecord(plugin) || typeof plugin.name !== 'string' || plugin.name === '') {
    throw new Error(`Plugin '${specifier}' must export an object with a non-empty 'name'`);
  }
  const connectors = plugin.connectors ?? {};
  if (!isRecord(connectors)) {
    throw new Error(`Plugin '${plugin.name}' (${specifier}): 'connectors' must be an object`);
  }
  for (const [type, fn] of Object.entries(connectors)) {
    if (typeof fn !== 'function') {
      throw new Error(`Plugin '${plugin.name}' (${specifier}): connector '${type}' must be a function`);
    }
  }

  return { name: plugin.name, specifier, connectors: connectors as Record<string, ConnectorFn> };
}

/** Loads every plugin listed in the config (does not mutate any registry). */
export function loadPlugins(config: LoadedConfig): LoadedPlugin[] {
  const projectRoot = projectRootOf(config);
  return config.plugins.map(specifier => loadOne(specifier, projectRoot));
}

/**
 * Loads the configured plugins and merges their connectors into `registry`.
 * Throws if a plugin connector's `type` collides with an existing connector
 * (a built-in or one from an earlier plugin) — silent overrides are unsafe.
 * Returns the loaded plugins for reporting.
 */
export function applyPlugins(registry: ConnectorRegistry, config: LoadedConfig): LoadedPlugin[] {
  const loaded = loadPlugins(config);
  for (const plugin of loaded) {
    for (const [type, fn] of Object.entries(plugin.connectors)) {
      if (registry.has(type)) {
        throw new Error(
          `Plugin '${plugin.name}' connector '${type}' conflicts with an existing connector`
        );
      }
      registry.set(type, fn);
    }
  }
  return loaded;
}
