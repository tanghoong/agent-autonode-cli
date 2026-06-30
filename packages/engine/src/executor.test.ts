import { describe, it, expect, vi } from 'vitest';
import { executeWorkflow } from './executor';
import { createInitialContext } from './context';
import { ConnectorRegistry } from './executor';
import { WorkflowDefinition } from '@autonode/shared';

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

  describe('parallel groups', () => {
    it('runs all children and merges their results into context', async () => {
      const ctx = createInitialContext();
      const connectors = new Map();
      connectors.set('a', async () => ({ output: 'A' }));
      connectors.set('b', async () => ({ output: 'B' }));

      const workflow: WorkflowDefinition = {
        name: 'par',
        steps: [
          {
            id: 'group',
            parallel: [
              { id: 'childA', type: 'a' },
              { id: 'childB', type: 'b' },
            ],
          },
        ],
      };

      const result = await executeWorkflow(workflow, ctx, connectors);
      expect(result.steps['childA']).toEqual({ output: 'A' });
      expect(result.steps['childB']).toEqual({ output: 'B' });
      // the group container itself produces no step result
      expect(result.steps['group']).toBeUndefined();
    });

    it('runs children concurrently (not sequentially)', async () => {
      const ctx = createInitialContext();
      // childA waits on a gate that childB opens. With sequential execution this
      // would deadlock; concurrency lets both make progress.
      let openGate: () => void = () => {};
      const gate = new Promise<void>(resolve => {
        openGate = resolve;
      });
      const connectors = new Map();
      connectors.set('waiter', async () => {
        await gate;
        return { output: 'waited' };
      });
      connectors.set('opener', async () => {
        openGate();
        return { output: 'opened' };
      });

      const workflow: WorkflowDefinition = {
        name: 'concurrent',
        steps: [
          {
            id: 'group',
            parallel: [
              { id: 'a', type: 'waiter' },
              { id: 'b', type: 'opener' },
            ],
          },
        ],
      };

      const result = await executeWorkflow(workflow, ctx, connectors);
      expect(result.steps['a']).toEqual({ output: 'waited' });
      expect(result.steps['b']).toEqual({ output: 'opened' });
    });

    it('fails the workflow when any child fails (fail-fast)', async () => {
      const ctx = createInitialContext();
      const connectors = new Map();
      connectors.set('ok', async () => ({ output: 'ok' }));
      connectors.set('bad', async () => {
        throw new Error('child boom');
      });

      const workflow: WorkflowDefinition = {
        name: 'par-fail',
        steps: [
          {
            id: 'group',
            parallel: [
              { id: 'good', type: 'ok' },
              { id: 'bad', type: 'bad' },
            ],
          },
        ],
      };

      await expect(executeWorkflow(workflow, ctx, connectors)).rejects.toThrow(/child boom/);
    });

    it('skips an entire group when its condition is false', async () => {
      const ctx = createInitialContext();
      const childFn = vi.fn().mockResolvedValue({ output: 'x' });
      const connectors = new Map();
      connectors.set('c', childFn);

      const workflow: WorkflowDefinition = {
        name: 'par-cond',
        steps: [
          {
            id: 'group',
            condition: 'false',
            parallel: [{ id: 'child', type: 'c' }],
          },
        ],
      };

      const result = await executeWorkflow(workflow, ctx, connectors);
      expect(childFn).not.toHaveBeenCalled();
      expect(result.steps['child']).toBeUndefined();
    });

    it('isolates children — a child cannot read a sibling output', async () => {
      const ctx = createInitialContext();
      const seen: Record<string, unknown> = {};
      const connectors = new Map();
      connectors.set('producer', async () => ({ output: 'produced' }));
      connectors.set('reader', async (config: Record<string, unknown>) => {
        seen.sibling = config.sibling;
        return { output: 'read' };
      });

      const workflow: WorkflowDefinition = {
        name: 'isolation',
        steps: [
          {
            id: 'group',
            parallel: [
              { id: 'producer', type: 'producer' },
              { id: 'reader', type: 'reader', with: { sibling: '{{ steps.producer.output }}' } },
            ],
          },
        ],
      };

      await executeWorkflow(workflow, ctx, connectors);
      // sibling output is not visible within the same group → interpolates to ''
      expect(seen.sibling).toBe('');
    });
  });
});
