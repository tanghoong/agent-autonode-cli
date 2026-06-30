import { WorkflowDefinition, WorkflowContext, StepResult, StepDefinition, logger } from '@autonode/shared';
import { interpolateObject, interpolate } from './interpolation';
import { addStepResult } from './context';
import { ExecutionError, TimeoutError, ConnectorNotFoundError } from './errors';

export type ConnectorFn = (config: Record<string, unknown>, context: WorkflowContext) => Promise<StepResult>;
export type ConnectorRegistry = Map<string, ConnectorFn>;

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, stepId: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(stepId, timeoutMs)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runStepWithRetry(
  step: StepDefinition,
  config: Record<string, unknown>,
  context: WorkflowContext,
  connector: ConnectorFn
): Promise<StepResult> {
  const attempts = step.retry?.attempts ?? 1;
  const delay = step.retry?.delay ?? 1000;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (attempt > 1) {
        logger.info(`Retrying step '${step.id}' (attempt ${attempt}/${attempts})...`);
        await new Promise(res => setTimeout(res, delay));
      }
      const runPromise = connector(config, context);
      if (step.timeout) {
        return await runWithTimeout(runPromise, step.timeout, step.id);
      }
      return await runPromise;
    } catch (err) {
      lastError = err as Error;
      logger.warn(`Step '${step.id}' failed on attempt ${attempt}: ${lastError.message}`);
    }
  }
  throw lastError ?? new ExecutionError(`Step '${step.id}' failed after ${attempts} attempts`, step.id);
}

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  context: WorkflowContext,
  connectors: ConnectorRegistry,
  hooks?: ExecutionHooks
): Promise<WorkflowContext> {
  let currentContext = context;

  for (const step of workflow.steps) {
    const results = await runStep(step, currentContext, connectors, hooks);
    for (const [id, result] of Object.entries(results)) {
      currentContext = addStepResult(currentContext, id, result);
    }
  }

  return currentContext;
}

export interface ExecutionHooks {
  onStepStart?: (stepId: string, stepType: string, input: Record<string, unknown>) => Promise<void>;
  onStepComplete?: (stepId: string, result: StepResult) => Promise<void>;
  onStepError?: (stepId: string, error: Error) => Promise<void>;
}

/** Evaluates a step's `condition` against the context; an absent condition runs. */
function conditionMet(step: StepDefinition, context: WorkflowContext): boolean {
  if (!step.condition) return true;
  const lower = interpolate(step.condition, context).trim().toLowerCase();
  return lower !== 'false' && lower !== '0' && lower !== 'no' && lower !== '';
}

/**
 * Runs a single step against `context` and returns the step results it produced,
 * keyed by step id. A normal step yields one entry; a parallel group yields one
 * entry per child. A skipped (condition-false) step yields none.
 */
async function runStep(
  step: StepDefinition,
  context: WorkflowContext,
  connectors: ConnectorRegistry,
  hooks?: ExecutionHooks
): Promise<Record<string, StepResult>> {
  if (!conditionMet(step, context)) {
    logger.info(`Skipping step '${step.id}': condition '${step.condition}' evaluated to false`);
    return {};
  }

  // Parallel group: run children concurrently against the SAME context snapshot.
  // Children cannot observe each other's outputs. The group fails if any child
  // fails, but we wait for every started child to SETTLE first (allSettled, not
  // all) so in-flight siblings finish their hooks/records — otherwise the caller
  // could close storage mid-step and leave sibling records stuck as 'running'.
  // (There is no true cancellation; a failed group still runs siblings to
  // completion.)
  if (step.parallel) {
    logger.info(`Executing parallel group '${step.id}' (${step.parallel.length} steps)`);
    const settled = await Promise.allSettled(
      step.parallel.map(child => runStep(child, context, connectors, hooks))
    );
    const firstRejection = settled.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (firstRejection) {
      throw firstRejection.reason;
    }
    const childResults = settled.map(
      r => (r as PromiseFulfilledResult<Record<string, StepResult>>).value
    );
    const merged = Object.assign({}, ...childResults) as Record<string, StepResult>;
    logger.success(`Parallel group '${step.id}' completed`);
    return merged;
  }

  const type = step.type;
  if (!type) {
    throw new ExecutionError(`Step '${step.id}' has neither 'type' nor 'parallel'`, step.id);
  }

  logger.info(`Executing step: ${step.id} (${type})`);

  const connector = connectors.get(type);
  if (!connector) {
    throw new ConnectorNotFoundError(type);
  }

  const rawConfig = step.with ?? {};
  const interpolatedConfig = interpolateObject(rawConfig, context) as Record<string, unknown>;

  if (hooks?.onStepStart) {
    await hooks.onStepStart(step.id, type, interpolatedConfig);
  }

  let result: StepResult;
  try {
    result = await runStepWithRetry(step, interpolatedConfig, context, connector);
  } catch (err) {
    const error = err as Error;
    if (hooks?.onStepError) {
      await hooks.onStepError(step.id, error);
    }
    throw new ExecutionError(`Step '${step.id}' failed: ${error.message}`, step.id);
  }

  if (hooks?.onStepComplete) {
    await hooks.onStepComplete(step.id, result);
  }

  logger.success(`Step '${step.id}' completed`);
  return { [step.id]: result };
}
