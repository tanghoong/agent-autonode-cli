import { describe, it, expect } from 'vitest';
import { transformJson } from './transform-json';
import { WorkflowContext } from '@autonode/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

const sampleInput = {
  user: { name: 'Alice', email: 'alice@example.com' },
  status: 'active',
};

describe('transform.json connector', () => {
  it('returns input unchanged when no template is provided', async () => {
    const result = await transformJson({ input: sampleInput }, emptyContext);
    expect(result.output).toEqual(sampleInput);
  });

  it('applies a string template with JSONPath-style expressions', async () => {
    const result = await transformJson(
      { input: sampleInput, template: '$.user.name' },
      emptyContext
    );
    expect(result.output).toBe('Alice');
  });

  it('applies an object template mapping', async () => {
    const result = await transformJson(
      { input: sampleInput, template: { name: '$.user.name', email: '$.user.email' } },
      emptyContext
    );
    expect(result.output).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  it('returns empty string for missing paths', async () => {
    const result = await transformJson(
      { input: sampleInput, template: '$.missing.field' },
      emptyContext
    );
    expect(result.output).toBe('');
  });

  it('handles nested template objects', async () => {
    const result = await transformJson(
      { input: sampleInput, template: { outer: { inner: '$.user.name' } } },
      emptyContext
    );
    expect(result.output).toEqual({ outer: { inner: 'Alice' } });
  });

  it('handles array templates', async () => {
    const result = await transformJson(
      { input: sampleInput, template: ['$.user.name', '$.status'] },
      emptyContext
    );
    expect(result.output).toEqual(['Alice', 'active']);
  });
});
