import { describe, it, expect, vi } from 'vitest';
import { executeWorkflow } from './executor';
import { createInitialContext } from './context';
import { ConnectorRegistry } from './executor';
import { WorkflowDefinition } from '@taskpipe/shared';

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    name: 'test-wf',
    steps: [{ id: 'step1', type: 'mock', with: { value: 'hello' } }],
    ...overrides,
  };
}

function makeRegistry(result = { output: 'ok' }): ConnectorRegistry {
  const registry = new Map<string, (config: Record<string, unknown>) => Promise<typeof result>>();
  registry.set('mock', async () => result);
  return registry;
}

describe('executeWorkflow', () => {
  it('runs a single step and returns updated context', async () => {
    const ctx = createInitialContext();
    const connectors = makeRegistry({ output: 'done' });
    const result = await executeWorkflow(makeWorkflow(), ctx, connectors);
    expect(result.steps['step1']).toEqual({ output: 'done' });
  });

  it('runs multiple steps sequentially', async () => {
    const ctx = createInitialContext();
    const calls: string[] = [];
    const connectors = new Map();
    connectors.set('a', async () => { calls.push('a'); return { output: 'a' }; });
    connectors.set('b', async () => { calls.push('b'); return { output: 'b' }; });

    const workflow: WorkflowDefinition = {
      name: 'multi',
      steps: [
        { id: 'stepA', type: 'a' },
        { id: 'stepB', type: 'b' },
      ],
    };

    await executeWorkflow(workflow, ctx, connectors);
    expect(calls).toEqual(['a', 'b']);
  });

  it('throws when connector is not found', async () => {
    const ctx = createInitialContext();
    const connectors = new Map();
    await expect(executeWorkflow(makeWorkflow(), ctx, connectors)).rejects.toThrow(/not found/i);
  });

  it('calls onStepStart and onStepComplete hooks', async () => {
    const ctx = createInitialContext();
    const connectors = makeRegistry({ output: 'result' });
    const onStepStart = vi.fn().mockResolvedValue(undefined);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);

    await executeWorkflow(makeWorkflow(), ctx, connectors, { onStepStart, onStepComplete });

    expect(onStepStart).toHaveBeenCalledWith('step1', 'mock', { value: 'hello' });
    expect(onStepComplete).toHaveBeenCalledWith('step1', { output: 'result' });
  });

  it('calls onStepError hook when step throws', async () => {
    const ctx = createInitialContext();
    const connectors = new Map();
    connectors.set('fail', async () => { throw new Error('boom'); });
    const onStepError = vi.fn().mockResolvedValue(undefined);
    const workflow: WorkflowDefinition = { name: 'fail-wf', steps: [{ id: 's1', type: 'fail' }] };

    await expect(
      executeWorkflow(workflow, ctx, connectors, { onStepError })
    ).rejects.toThrow();

    expect(onStepError).toHaveBeenCalledWith('s1', expect.any(Error));
  });

  it('skips step when condition evaluates to false', async () => {
    const ctx = createInitialContext();
    const mockFn = vi.fn().mockResolvedValue({ output: 'ok' });
    const connectors = new Map();
    connectors.set('mock', mockFn);

    const workflow: WorkflowDefinition = {
      name: 'cond-wf',
      steps: [{ id: 's1', type: 'mock', condition: 'false' }],
    };

    await executeWorkflow(workflow, ctx, connectors);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('runs step when condition evaluates to true', async () => {
    const ctx = createInitialContext();
    const mockFn = vi.fn().mockResolvedValue({ output: 'ok' });
    const connectors = new Map();
    connectors.set('mock', mockFn);

    const workflow: WorkflowDefinition = {
      name: 'cond-wf',
      steps: [{ id: 's1', type: 'mock', condition: 'true' }],
    };

    await executeWorkflow(workflow, ctx, connectors);
    expect(mockFn).toHaveBeenCalled();
  });

  it('retries a failing step the configured number of times', async () => {
    const ctx = createInitialContext();
    let attempts = 0;
    const connectors = new Map();
    connectors.set('flaky', async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return { output: 'recovered' };
    });

    const workflow: WorkflowDefinition = {
      name: 'retry-wf',
      steps: [{ id: 's1', type: 'flaky', retry: { attempts: 3, delay: 0 } }],
    };

    const result = await executeWorkflow(workflow, ctx, connectors);
    expect(result.steps['s1']).toEqual({ output: 'recovered' });
    expect(attempts).toBe(3);
  });
});
