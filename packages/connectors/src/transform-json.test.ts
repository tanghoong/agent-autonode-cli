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

  it('evaluates a JSONPath expression and returns matches as an array', async () => {
    const result = await transformJson(
      { input: sampleInput, expression: '$.user.name' },
      emptyContext
    );
    expect(result.output).toEqual(['Alice']);
  });

  it('evaluates a filtered JSONPath expression over an array', async () => {
    const input = { items: [{ n: 'a', ok: true }, { n: 'b', ok: false }, { n: 'c', ok: true }] };
    const result = await transformJson(
      { input, expression: '$.items[?(@.ok==true)].n' },
      emptyContext
    );
    expect(result.output).toEqual(['a', 'c']);
  });

  it('prefers expression over template when both are provided', async () => {
    const result = await transformJson(
      { input: sampleInput, expression: '$.status', template: '$.user.name' },
      emptyContext
    );
    expect(result.output).toEqual(['active']);
  });
});
