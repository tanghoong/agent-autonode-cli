import { WorkflowDefinition, WorkflowContext, StepResult, StepDefinition, logger } from '@taskpipe/shared';
import { interpolateObject } from './interpolation';
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
  hooks?: {
    onStepStart?: (stepId: string, stepType: string, input: Record<string, unknown>) => Promise<void>;
    onStepComplete?: (stepId: string, result: StepResult) => Promise<void>;
    onStepError?: (stepId: string, error: Error) => Promise<void>;
  }
): Promise<WorkflowContext> {
  let currentContext = context;

  for (const step of workflow.steps) {
    logger.info(`Executing step: ${step.id} (${step.type})`);

    const connector = connectors.get(step.type);
    if (!connector) {
      throw new ConnectorNotFoundError(step.type);
    }

    const rawConfig = step.with ?? {};
    const interpolatedConfig = interpolateObject(rawConfig, currentContext) as Record<string, unknown>;

    if (hooks?.onStepStart) {
      await hooks.onStepStart(step.id, step.type, interpolatedConfig);
    }

    let result: StepResult;
    try {
      result = await runStepWithRetry(step, interpolatedConfig, currentContext, connector);
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

    currentContext = addStepResult(currentContext, step.id, result);
    logger.success(`Step '${step.id}' completed`);
  }

  return currentContext;
}
