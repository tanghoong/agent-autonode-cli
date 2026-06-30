import { describe, it, expect } from 'vitest';
import { buildRegistry } from './registry';

describe('buildRegistry', () => {
  it('returns a registry with all built-in connectors', async () => {
    const registry = await buildRegistry();
    const types = [...registry.keys()].sort();
    expect(types).toEqual(
      [
        'agent.prompt',
        'condition',
        'file.read',
        'file.write',
        'http.request',
        'log',
        'transform.json',
      ].sort()
    );
  });

  it('returns connectors that are callable functions', async () => {
    const registry = await buildRegistry();
    expect(typeof registry.get('log')).toBe('function');
  });
});
