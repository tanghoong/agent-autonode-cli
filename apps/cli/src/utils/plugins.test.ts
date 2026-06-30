import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDefaultRegistry } from '@autonode/connectors';
import { loadConfig, CONFIG_FILENAME } from './config';
import { loadPlugins, applyPlugins } from './plugins';
import { buildRegistry } from './registry';

describe('plugin loader', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonode-plugins-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Writes a CJS plugin file and points the config at it. */
  const setup = (pluginSource: string, plugins: string[] = ['./plugin.js']) => {
    fs.writeFileSync(path.join(dir, 'plugin.js'), pluginSource);
    fs.writeFileSync(path.join(dir, CONFIG_FILENAME), JSON.stringify({ plugins }));
    return loadConfig(dir);
  };

  it('loads connectors from a plugin object export', () => {
    const config = setup(
      `module.exports = { name: 'demo', connectors: { 'demo.echo': async (c) => ({ output: c.value }) } };`
    );
    const loaded = loadPlugins(config);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('demo');
    expect(Object.keys(loaded[0].connectors)).toEqual(['demo.echo']);
  });

  it('loads a plugin exported as an activator function', () => {
    const config = setup(
      `module.exports = () => ({ name: 'fn-plugin', connectors: { 'fn.noop': async () => ({}) } });`
    );
    const loaded = loadPlugins(config);
    expect(loaded[0].name).toBe('fn-plugin');
    expect(Object.keys(loaded[0].connectors)).toEqual(['fn.noop']);
  });

  it('supports an ESM-style default export', () => {
    const config = setup(
      `Object.defineProperty(exports, '__esModule', { value: true });
       exports.default = { name: 'esm', connectors: { 'esm.x': async () => ({}) } };`
    );
    expect(loadPlugins(config)[0].name).toBe('esm');
  });

  it('merges plugin connectors into the registry via buildRegistry', async () => {
    const config = setup(
      `module.exports = { name: 'demo', connectors: { 'demo.echo': async (c) => ({ output: c.value }) } };`
    );
    const registry = await buildRegistry({ config });
    expect(registry.has('demo.echo')).toBe(true);
    // built-ins are still present
    expect(registry.has('http.request')).toBe(true);
    const fn = registry.get('demo.echo')!;
    const result = await fn({ value: 'hi' }, { trigger: { body: {}, headers: {}, query: {} }, steps: {}, env: {}, secrets: {} });
    expect(result.output).toBe('hi');
  });

  it('skips plugins when plugins:false', async () => {
    const config = setup(
      `module.exports = { name: 'demo', connectors: { 'demo.echo': async () => ({}) } };`
    );
    const registry = await buildRegistry({ config, plugins: false });
    expect(registry.has('demo.echo')).toBe(false);
    expect(registry.has('http.request')).toBe(true);
  });

  it('throws when a plugin connector collides with a built-in', async () => {
    const config = setup(
      `module.exports = { name: 'bad', connectors: { 'log': async () => ({}) } };`
    );
    await expect(buildRegistry({ config })).rejects.toThrow(/conflicts with an existing connector/);
  });

  it('applyPlugins merges into a registry and returns the loaded plugins', () => {
    const config = setup(
      `module.exports = { name: 'demo', connectors: { 'demo.echo': async () => ({}) } };`
    );
    const registry = createDefaultRegistry();
    const loaded = applyPlugins(registry, config);
    expect(loaded.map(p => p.name)).toEqual(['demo']);
    expect(registry.has('demo.echo')).toBe(true);
  });

  it('applyPlugins surfaces collisions (the path plugins list uses)', () => {
    const config = setup(
      `module.exports = { name: 'bad', connectors: { 'log': async () => ({}) } };`
    );
    expect(() => applyPlugins(createDefaultRegistry(), config)).toThrow(
      /conflicts with an existing connector/
    );
  });

  it('throws when a plugin has no name', () => {
    const config = setup(`module.exports = { connectors: {} };`);
    expect(() => loadPlugins(config)).toThrow(/non-empty 'name'/);
  });

  it('throws when a connector is not a function', () => {
    const config = setup(`module.exports = { name: 'bad', connectors: { 'x': 42 } };`);
    expect(() => loadPlugins(config)).toThrow(/must be a function/);
  });

  it('throws a clear error when the plugin module cannot be resolved', () => {
    const config = setup(`module.exports = { name: 'ok' };`, ['./does-not-exist.js']);
    expect(() => loadPlugins(config)).toThrow(/Failed to load plugin/);
  });
});
