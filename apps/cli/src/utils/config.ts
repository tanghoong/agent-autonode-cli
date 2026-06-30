/**
 * Project configuration for Autonode.
 *
 * Autonode looks for an `autonode.config.json` file, starting in the current
 * working directory and walking up toward the filesystem root (so commands work
 * from any subdirectory of a project). The config is hand-validated — no schema
 * dependency — to keep the CLI lean.
 */
import * as fs from 'fs';
import * as path from 'path';

export const CONFIG_FILENAME = 'autonode.config.json';

export interface AutonodeConfig {
  /** npm package names or local module paths that contribute custom connectors. */
  plugins: string[];
}

export interface LoadedConfig extends AutonodeConfig {
  /** Absolute path the config was read from, or undefined when defaults are used. */
  path?: string;
}

const DEFAULT_CONFIG: AutonodeConfig = { plugins: [] };

/** Walks up from `startDir` to the filesystem root looking for the config file. */
export function findConfigFile(startDir: string = process.cwd()): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function validateConfig(raw: unknown, filePath: string): AutonodeConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid config in ${filePath}: expected a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  let plugins: string[] = [];
  if (obj.plugins !== undefined) {
    if (!Array.isArray(obj.plugins) || !obj.plugins.every(p => typeof p === 'string')) {
      throw new Error(`Invalid config in ${filePath}: "plugins" must be an array of strings`);
    }
    plugins = obj.plugins;
  }
  return { plugins };
}

/**
 * Loads the Autonode config, returning defaults (no plugins) when no config
 * file is found. Throws with a clear message on unreadable or malformed files.
 */
export function loadConfig(startDir: string = process.cwd()): LoadedConfig {
  const filePath = findConfigFile(startDir);
  if (!filePath) return { ...DEFAULT_CONFIG };

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read config ${filePath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse config ${filePath}: ${(err as Error).message}`);
  }

  return { ...validateConfig(parsed, filePath), path: filePath };
}
