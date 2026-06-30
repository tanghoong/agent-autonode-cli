import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, findConfigFile, CONFIG_FILENAME } from './config';

describe('config loader', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonode-config-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (contents: string, at: string = dir) => {
    fs.writeFileSync(path.join(at, CONFIG_FILENAME), contents);
  };

  it('returns defaults when no config file is found', () => {
    const config = loadConfig(dir);
    expect(config.plugins).toEqual([]);
    expect(config.path).toBeUndefined();
  });

  it('loads and parses a valid config', () => {
    writeConfig(JSON.stringify({ plugins: ['@scope/connector', './local.js'] }));
    const config = loadConfig(dir);
    expect(config.plugins).toEqual(['@scope/connector', './local.js']);
    expect(config.path).toBe(path.join(dir, CONFIG_FILENAME));
  });

  it('defaults plugins to an empty array when the key is omitted', () => {
    writeConfig(JSON.stringify({}));
    expect(loadConfig(dir).plugins).toEqual([]);
  });

  it('discovers the config by walking up from a nested directory', () => {
    writeConfig(JSON.stringify({ plugins: ['p'] }));
    const nested = path.join(dir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    const config = loadConfig(nested);
    expect(config.plugins).toEqual(['p']);
    expect(config.path).toBe(path.join(dir, CONFIG_FILENAME));
  });

  it('throws a clear error on malformed JSON', () => {
    writeConfig('{ not json');
    expect(() => loadConfig(dir)).toThrow(/Failed to parse config/);
  });

  it('throws when plugins is not an array of strings', () => {
    writeConfig(JSON.stringify({ plugins: 'nope' }));
    expect(() => loadConfig(dir)).toThrow(/"plugins" must be an array of strings/);

    writeConfig(JSON.stringify({ plugins: [1, 2] }));
    expect(() => loadConfig(dir)).toThrow(/"plugins" must be an array of strings/);
  });

  it('throws when the config is not a JSON object', () => {
    writeConfig(JSON.stringify(['a', 'b']));
    expect(() => loadConfig(dir)).toThrow(/expected a JSON object/);
  });

  it('findConfigFile returns undefined when nothing is found', () => {
    expect(findConfigFile(dir)).toBeUndefined();
  });
});
