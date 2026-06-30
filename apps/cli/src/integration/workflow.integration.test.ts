/**
 * End-to-end integration tests for Autonode.
 *
 * Unlike the per-package unit tests, these exercise the full pipeline wired
 * together exactly as the `run` command does it: parse YAML → validate schema
 * → build context (trigger + secrets) → execute steps through the real
 * connector registry → persist the run and every step to SQLite storage.
 *
 * They cover the v0.2 "integration tests for end-to-end scenarios" roadmap item.
 */
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  parseWorkflowYaml,
  validateWorkflow,
  executeWorkflow,
  createInitialContext,
  type ConnectorRegistry,
} from '@autonode/engine';
import { createDefaultRegistry } from '@autonode/connectors';
import { AutonodeStorage } from '@autonode/storage';
import type { StepResult, WorkflowContext } from '@autonode/shared';

interface RunResult {
  context: WorkflowContext;
  runId: string;
  storage: AutonodeStorage;
}

/**
 * Mirrors apps/cli/src/commands/run.ts: drives a workflow through validation,
 * execution and persistence so the test sees the same code paths a real run does.
 */
async function runWorkflow(
  yamlContent: string,
  opts: {
    triggerData?: Partial<WorkflowContext['trigger']>;
    secrets?: Record<string, string>;
    registry?: ConnectorRegistry;
  } = {}
): Promise<RunResult> {
  const workflow = validateWorkflow(parseWorkflowYaml(yamlContent));
  const storage = new AutonodeStorage(':memory:');
  const runRecord = storage.createRun(workflow.name, workflow.trigger?.type ?? 'manual');
  const context = createInitialContext(opts.triggerData ?? {}, opts.secrets ?? {});
  const connectors = opts.registry ?? createDefaultRegistry();
  const stepRecords = new Map<string, string>();

  storage.updateRun(runRecord.id, 'running');

  try {
    const finalContext = await executeWorkflow(workflow, context, connectors, {
      onStepStart: async (stepId, stepType, input) => {
        const stepRun = storage.createStepRun(runRecord.id, stepId, stepType, input);
        stepRecords.set(stepId, stepRun.id);
      },
      onStepComplete: async (stepId, result: StepResult) => {
        const id = stepRecords.get(stepId);
        if (id) storage.updateStepRun(id, 'success', result);
      },
      onStepError: async (stepId, error) => {
        const id = stepRecords.get(stepId);
        if (id) storage.updateStepRun(id, 'failed', undefined, error.message);
      },
    });
    storage.updateRun(runRecord.id, 'success');
    return { context: finalContext, runId: runRecord.id, storage };
  } catch (err) {
    storage.updateRun(runRecord.id, 'failed', (err as Error).message);
    throw Object.assign(err as Error, { runId: runRecord.id, storage });
  }
}

describe('integration: end-to-end workflow execution', () => {
  let originalCwd: string;
  let workDir: string;

  // file.read / file.write only allow relative paths inside the process cwd,
  // so run these tests from a throwaway temp directory.
  beforeAll(() => {
    originalCwd = process.cwd();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonode-it-'));
    process.chdir(workDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean any files a previous test wrote into the work dir.
    for (const entry of fs.readdirSync(workDir)) {
      fs.rmSync(path.join(workDir, entry), { recursive: true, force: true });
    }
  });

  it('runs a multi-step workflow and persists run + step records to storage', async () => {
    const yaml = `
name: e2e-pipeline
trigger:
  type: webhook.trigger
steps:
  - id: announce
    type: log
    with:
      message: "starting {{ trigger.body.name }}"
  - id: shape
    type: transform.json
    with:
      input: "{{ trigger.body }}"
      template:
        greeting: "Hello $.name"
  - id: persist
    type: file.write
    with:
      path: out/result.txt
      content: "{{ steps.shape.output.greeting }}"
  - id: readback
    type: file.read
    with:
      path: out/result.txt
`;
    const { context, runId, storage } = await runWorkflow(yaml, {
      triggerData: { body: { name: 'Ada' } },
    });

    // Data flowed across steps: trigger → transform → file.write → file.read.
    expect((context.steps.shape.output as { greeting: string }).greeting).toBe('Hello Ada');
    expect(context.steps.readback.output).toBe('Hello Ada');
    expect(fs.readFileSync(path.join(workDir, 'out/result.txt'), 'utf-8')).toBe('Hello Ada');

    // Run is recorded as a success.
    const run = storage.getRun(runId);
    expect(run?.status).toBe('success');
    expect(run?.workflowName).toBe('e2e-pipeline');
    expect(run?.triggerType).toBe('webhook.trigger');
    expect(run?.completedAt).toBeTruthy();

    // Every step is persisted with its serialized output.
    const steps = storage.listStepRuns(runId);
    expect(steps.map(s => s.stepId).sort()).toEqual(['announce', 'persist', 'readback', 'shape']);
    expect(steps.every(s => s.status === 'success')).toBe(true);
    const readbackRecord = steps.find(s => s.stepId === 'readback');
    expect(JSON.parse(readbackRecord!.output!).output).toBe('Hello Ada');

    storage.close();
  });

  it('interpolates secrets and trigger data into step config', async () => {
    const yaml = `
name: secrets-flow
steps:
  - id: write_token
    type: file.write
    with:
      path: token.txt
      content: "{{ secrets.API_TOKEN }}@{{ trigger.body.user }}"
  - id: read_token
    type: file.read
    with:
      path: token.txt
`;
    const { context, storage, runId } = await runWorkflow(yaml, {
      triggerData: { body: { user: 'grace' } },
      secrets: { API_TOKEN: 's3cr3t' },
    });

    expect(context.steps.read_token.output).toBe('s3cr3t@grace');
    expect(storage.getRun(runId)?.status).toBe('success');
    storage.close();
  });

  it('skips a step whose condition evaluates to false, runs it when true', async () => {
    const yaml = `
name: conditional
steps:
  - id: maybe
    type: log
    condition: "{{ trigger.body.enabled }}"
    with:
      message: "ran"
  - id: always
    type: log
    with:
      message: "always"
`;
    const skipped = await runWorkflow(yaml, { triggerData: { body: { enabled: false } } });
    expect(skipped.context.steps.maybe).toBeUndefined();
    expect(skipped.context.steps.always).toBeDefined();
    // The skipped step is never recorded in storage either.
    expect(skipped.storage.listStepRuns(skipped.runId).map(s => s.stepId)).toEqual(['always']);
    skipped.storage.close();

    const ran = await runWorkflow(yaml, { triggerData: { body: { enabled: true } } });
    expect(ran.context.steps.maybe).toBeDefined();
    ran.storage.close();
  });

  it('marks the run failed and records the error when a step throws', async () => {
    const yaml = `
name: failing-run
steps:
  - id: ok
    type: log
    with:
      message: "before failure"
  - id: boom
    type: file.read
    with:
      path: does-not-exist.txt
`;
    await expect(
      runWorkflow(yaml)
    ).rejects.toMatchObject({ name: 'ExecutionError' });

    // Re-run capturing the thrown error to inspect persisted state.
    let captured: (Error & { runId: string; storage: AutonodeStorage }) | undefined;
    try {
      await runWorkflow(yaml);
    } catch (err) {
      captured = err as Error & { runId: string; storage: AutonodeStorage };
    }
    expect(captured).toBeDefined();
    const run = captured!.storage.getRun(captured!.runId);
    expect(run?.status).toBe('failed');
    expect(run?.error).toContain('boom');

    const steps = captured!.storage.listStepRuns(captured!.runId);
    const okStep = steps.find(s => s.stepId === 'ok');
    const boomStep = steps.find(s => s.stepId === 'boom');
    expect(okStep?.status).toBe('success');
    expect(boomStep?.status).toBe('failed');
    expect(boomStep?.error).toBeTruthy();
    captured!.storage.close();
  });

  it('retries a flaky step per its retry config and ultimately succeeds', async () => {
    let attempts = 0;
    const registry = createDefaultRegistry();
    registry.set('test.flaky', async () => {
      attempts += 1;
      if (attempts < 3) throw new Error(`transient failure ${attempts}`);
      return { output: 'recovered' };
    });

    const yaml = `
name: retrying
steps:
  - id: flaky
    type: test.flaky
    retry:
      attempts: 3
      delay: 0
`;
    const { context, storage, runId } = await runWorkflow(yaml, { registry });

    expect(attempts).toBe(3);
    expect(context.steps.flaky.output).toBe('recovered');
    expect(storage.getRun(runId)?.status).toBe('success');
    storage.close();
  });

  it('runs a parallel group end-to-end and persists each child', async () => {
    const yaml = `
name: parallel-pipeline
steps:
  - id: fanout
    parallel:
      - id: write_a
        type: file.write
        with:
          path: a.txt
          content: "alpha"
      - id: write_b
        type: file.write
        with:
          path: b.txt
          content: "beta"
  - id: combine
    type: transform.json
    with:
      input:
        a: "{{ steps.write_a.output }}"
        b: "{{ steps.write_b.output }}"
`;
    const { context, runId, storage } = await runWorkflow(yaml);

    // Both children ran and both files exist.
    expect(fs.readFileSync(path.join(workDir, 'a.txt'), 'utf-8')).toBe('alpha');
    expect(fs.readFileSync(path.join(workDir, 'b.txt'), 'utf-8')).toBe('beta');
    // Child outputs are visible to the later (sequential) step.
    expect(context.steps.write_a).toBeDefined();
    expect(context.steps.write_b).toBeDefined();
    expect(context.steps.fanout).toBeUndefined();

    const run = storage.getRun(runId);
    expect(run?.status).toBe('success');
    // Each child is persisted as its own step record (the group container is not).
    const stepIds = storage.listStepRuns(runId).map(s => s.stepId).sort();
    expect(stepIds).toEqual(['combine', 'write_a', 'write_b']);
    storage.close();
  });

  it('runs a forEach loop end-to-end and exposes per-item results', async () => {
    const yaml = `
name: foreach-pipeline
steps:
  - id: write_each
    forEach:
      items: "{{ trigger.body.names }}"
      as: name
      steps:
        - id: save
          type: file.write
          with:
            path: "out/{{ name }}.txt"
            content: "hello {{ name }}"
  - id: count
    type: transform.json
    with:
      input: "{{ steps.write_each.output }}"
      expression: "$[*].save.output"
`;
    const { context, runId, storage } = await runWorkflow(yaml, {
      triggerData: { body: { names: ['ada', 'linus'] } },
    });

    // A file was written per item.
    expect(fs.readFileSync(path.join(workDir, 'out/ada.txt'), 'utf-8')).toBe('hello ada');
    expect(fs.readFileSync(path.join(workDir, 'out/linus.txt'), 'utf-8')).toBe('hello linus');

    // The loop exposes an array of per-item result maps under its id.
    const loopOut = context.steps.write_each.output as Array<Record<string, { output: string }>>;
    expect(loopOut).toHaveLength(2);
    expect(loopOut[0].save.output).toContain('ada.txt');

    // The loop is recorded as a single step (sub-steps are not individually recorded).
    const run = storage.getRun(runId);
    expect(run?.status).toBe('success');
    const stepIds = storage.listStepRuns(runId).map(s => s.stepId).sort();
    expect(stepIds).toEqual(['count', 'write_each']);
    storage.close();
  });

  it('rejects an invalid workflow before any run is created', () => {
    // Missing required `steps` array — caught at the validate stage.
    expect(() => validateWorkflow(parseWorkflowYaml('name: no-steps'))).toThrow(/validation failed/i);

    // Invalid step id (not an identifier) — caught by the step schema.
    const badId = `
name: bad-step-id
steps:
  - id: "1-invalid"
    type: log
    with:
      message: hi
`;
    expect(() => validateWorkflow(parseWorkflowYaml(badId))).toThrow(/identifier/i);
  });
});
