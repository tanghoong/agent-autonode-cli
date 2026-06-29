import { describe, it, expect } from 'vitest';
import { condition } from './condition';
import { WorkflowContext } from '@autonode/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

describe('condition connector', () => {
  it('returns true for "true"', async () => {
    const result = await condition({ if: 'true' }, emptyContext);
    expect(result.output).toBe(true);
    expect(result.branch).toBe('then');
  });

  it('returns false for "false"', async () => {
    const result = await condition({ if: 'false' }, emptyContext);
    expect(result.output).toBe(false);
    expect(result.branch).toBe('else');
  });

  it('returns true for "1"', async () => {
    const result = await condition({ if: '1' }, emptyContext);
    expect(result.output).toBe(true);
  });

  it('returns false for "0"', async () => {
    const result = await condition({ if: '0' }, emptyContext);
    expect(result.output).toBe(false);
  });

  it('evaluates == for equal numbers', async () => {
    const result = await condition({ if: '200 == 200' }, emptyContext);
    expect(result.output).toBe(true);
  });

  it('evaluates == for unequal numbers', async () => {
    const result = await condition({ if: '200 == 404' }, emptyContext);
    expect(result.output).toBe(false);
  });

  it('evaluates != for not-equal strings', async () => {
    const result = await condition({ if: 'foo != bar' }, emptyContext);
    expect(result.output).toBe(true);
  });

  it('evaluates >= correctly', async () => {
    const r1 = await condition({ if: '5 >= 3' }, emptyContext);
    expect(r1.output).toBe(true);
    const r2 = await condition({ if: '3 >= 5' }, emptyContext);
    expect(r2.output).toBe(false);
  });

  it('evaluates <= correctly', async () => {
    const r1 = await condition({ if: '3 <= 5' }, emptyContext);
    expect(r1.output).toBe(true);
    const r2 = await condition({ if: '5 <= 3' }, emptyContext);
    expect(r2.output).toBe(false);
  });

  it('evaluates > correctly', async () => {
    const r = await condition({ if: '10 > 5' }, emptyContext);
    expect(r.output).toBe(true);
  });

  it('evaluates < correctly', async () => {
    const r = await condition({ if: '3 < 10' }, emptyContext);
    expect(r.output).toBe(true);
  });

  it('returns the then branch object when condition is true', async () => {
    const thenBranch = { action: 'proceed' };
    const result = await condition({ if: 'true', then: thenBranch }, emptyContext);
    expect(result.result).toEqual(thenBranch);
  });

  it('returns the else branch object when condition is false', async () => {
    const elseBranch = { action: 'abort' };
    const result = await condition({ if: 'false', else: elseBranch }, emptyContext);
    expect(result.result).toEqual(elseBranch);
  });

  it('throws when if expression is missing', async () => {
    await expect(condition({}, emptyContext)).rejects.toThrow(/if expression is required/);
  });

  it('treats non-empty non-boolean string as truthy', async () => {
    const result = await condition({ if: 'someValue' }, emptyContext);
    expect(result.output).toBe(true);
  });

  it('treats empty string as false', async () => {
    const result = await condition({ if: '' }, emptyContext);
    expect(result.output).toBe(false);
  });
});
