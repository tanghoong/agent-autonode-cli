import { WorkflowContext, StepResult } from '@taskpipe/shared';

interface ConditionConfig {
  if: string;
  then?: Record<string, unknown>;
  else?: Record<string, unknown>;
}

function evaluateCondition(expression: string, _context: WorkflowContext): boolean {
  // Simple truthy evaluation - expression should already be interpolated
  const trimmed = expression.trim().toLowerCase();
  if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') return true;
  if (trimmed === 'false' || trimmed === '0' || trimmed === 'no' || trimmed === '') return false;
  // Try numeric comparison
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return !!(${expression})`);
    return fn() as boolean;
  } catch {
    return Boolean(expression);
  }
}

export async function condition(
  config: Record<string, unknown>,
  context: WorkflowContext
): Promise<StepResult> {
  const { if: ifExpr, then: thenBranch, else: elseBranch } = config as unknown as ConditionConfig;
  if (!ifExpr) throw new Error('condition: if expression is required');

  const result = evaluateCondition(ifExpr, context);
  const branch = result ? thenBranch : elseBranch;

  return {
    output: result,
    branch: result ? 'then' : 'else',
    result: branch ?? null,
  };
}
