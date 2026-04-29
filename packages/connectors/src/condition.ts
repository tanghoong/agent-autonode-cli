import { WorkflowContext, StepResult } from '@taskpipe/shared';

interface ConditionConfig {
  if: string;
  then?: Record<string, unknown>;
  else?: Record<string, unknown>;
}

type ComparisonOperator = '===' | '!==' | '==' | '!=' | '>=' | '<=' | '>' | '<';

const COMPARISON_OPERATORS: ComparisonOperator[] = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];

function compareValues(left: string, op: ComparisonOperator, right: string): boolean {
  const lNum = Number(left);
  const rNum = Number(right);
  const bothNumeric = !Number.isNaN(lNum) && !Number.isNaN(rNum);

  switch (op) {
    case '===': return left === right;
    case '!==': return left !== right;
    case '==': return bothNumeric ? lNum === rNum : left === right;
    case '!=': return bothNumeric ? lNum !== rNum : left !== right;
    case '>=': return bothNumeric ? lNum >= rNum : left >= right;
    case '<=': return bothNumeric ? lNum <= rNum : left <= right;
    case '>': return bothNumeric ? lNum > rNum : left > right;
    case '<': return bothNumeric ? lNum < rNum : left < right;
  }
}

function evaluateCondition(expression: string, _context: WorkflowContext): boolean {
  const trimmed = expression.trim();

  // Handle simple boolean-like strings
  const lower = trimmed.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === '') return false;

  // Try safe comparison: <left> <op> <right>
  for (const op of COMPARISON_OPERATORS) {
    const idx = trimmed.indexOf(op);
    if (idx === -1) continue;

    const left = trimmed.slice(0, idx).trim().replace(/^['"]|['"]$/g, '');
    const right = trimmed.slice(idx + op.length).trim().replace(/^['"]|['"]$/g, '');

    // Make sure neither side contains further operators to avoid partial matches
    if (left.includes('(') || right.includes(')')) continue;

    return compareValues(left, op, right);
  }

  // Fallback: non-empty string is truthy
  return Boolean(trimmed);
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
