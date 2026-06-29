import { describe, it, expect } from 'vitest';
import { interpolate, interpolateObject } from './interpolation';
import { WorkflowContext } from '@autonode/shared';

const ctx: WorkflowContext = {
  trigger: {
    body: { name: 'Alice', count: 42 },
    headers: { x_token: 'secret123' },
    query: { page: '1' },
  },
  steps: {
    fetch: { status: 200, body: { items: [1, 2, 3] } },
    log: { output: 'done' },
  },
  env: { NODE_ENV: 'test' },
  secrets: { API_KEY: 'mykey' },
};

describe('interpolate', () => {
  it('replaces a trigger body field', () => {
    expect(interpolate('Hello {{ trigger.body.name }}', ctx)).toBe('Hello Alice');
  });

  it('replaces a trigger header', () => {
    expect(interpolate('token={{ trigger.headers.x_token }}', ctx)).toBe('token=secret123');
  });

  it('replaces a trigger query param', () => {
    expect(interpolate('page={{ trigger.query.page }}', ctx)).toBe('page=1');
  });

  it('replaces a step output string', () => {
    expect(interpolate('{{ steps.log.output }}', ctx)).toBe('done');
  });

  it('serialises an object step output to JSON', () => {
    expect(interpolate('{{ steps.fetch.body }}', ctx)).toBe('{"items":[1,2,3]}');
  });

  it('replaces an env variable', () => {
    expect(interpolate('env={{ env.NODE_ENV }}', ctx)).toBe('env=test');
  });

  it('replaces a secret', () => {
    expect(interpolate('key={{ secrets.API_KEY }}', ctx)).toBe('key=mykey');
  });

  it('replaces multiple expressions in one string', () => {
    expect(interpolate('{{ trigger.body.name }} - {{ env.NODE_ENV }}', ctx)).toBe('Alice - test');
  });

  it('returns empty string for missing keys', () => {
    expect(interpolate('{{ steps.missing.field }}', ctx)).toBe('');
  });

  it('leaves non-template text unchanged', () => {
    expect(interpolate('plain text', ctx)).toBe('plain text');
  });
});

describe('interpolateObject', () => {
  it('interpolates strings inside an object', () => {
    const result = interpolateObject({ url: 'https://api.example.com/{{ trigger.body.name }}' }, ctx);
    expect(result).toEqual({ url: 'https://api.example.com/Alice' });
  });

  it('returns the raw value when the whole string is a single expression', () => {
    const result = interpolateObject({ body: '{{ steps.fetch.body }}' }, ctx);
    expect((result as Record<string, unknown>).body).toEqual({ items: [1, 2, 3] });
  });

  it('interpolates nested objects recursively', () => {
    const result = interpolateObject(
      { outer: { inner: '{{ trigger.body.name }}' } },
      ctx
    ) as Record<string, Record<string, string>>;
    expect(result.outer.inner).toBe('Alice');
  });

  it('interpolates arrays element-by-element', () => {
    const result = interpolateObject(['{{ trigger.body.name }}', 'static'], ctx);
    expect(result).toEqual(['Alice', 'static']);
  });

  it('passes through numbers unchanged', () => {
    expect(interpolateObject(42, ctx)).toBe(42);
  });

  it('passes through booleans unchanged', () => {
    expect(interpolateObject(true, ctx)).toBe(true);
  });

  it('passes through null unchanged', () => {
    expect(interpolateObject(null, ctx)).toBe(null);
  });
});
