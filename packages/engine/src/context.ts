import { WorkflowContext, StepResult } from '@autonode/shared';

export function createInitialContext(
  triggerData: Partial<WorkflowContext['trigger']> = {},
  secrets: Record<string, string> = {}
): WorkflowContext {
  return {
    trigger: {
      body: triggerData.body ?? {},
      headers: triggerData.headers ?? {},
      query: triggerData.query ?? {},
    },
    steps: {},
    env: Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as string])
    ),
    secrets,
  };
}

export function addStepResult(
  context: WorkflowContext,
  stepId: string,
  result: StepResult
): WorkflowContext {
  return {
    ...context,
    steps: {
      ...context.steps,
      [stepId]: result,
    },
  };
}
