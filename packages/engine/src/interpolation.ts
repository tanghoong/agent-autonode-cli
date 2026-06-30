import { WorkflowContext } from '@autonode/shared';

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function resolveExpression(expr: string, context: WorkflowContext): unknown {
  const parts = expr.trim().split('.');
  const root = parts[0];
  const rest = parts.slice(1);

  if (root === 'trigger') {
    return getNestedValue(context.trigger, rest);
  } else if (root === 'steps') {
    return getNestedValue(context.steps, rest);
  } else if (root === 'env') {
    return rest.length > 0 ? context.env[rest[0]] : undefined;
  } else if (root === 'secrets') {
    return rest.length > 0 ? context.secrets[rest[0]] : undefined;
  } else if (context.vars && root in context.vars) {
    // Loop-scoped variables (e.g. the current `forEach` item).
    return rest.length > 0 ? getNestedValue(context.vars[root], rest) : context.vars[root];
  }
  return undefined;
}

export function interpolate(template: string, context: WorkflowContext): string {
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (match, expr: string) => {
    const value = resolveExpression(expr, context);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Interpolates values in an object/array/string using the workflow context.
 * When an entire string value is a single `{{ expr }}` expression, the raw
 * resolved value (object, number, boolean, etc.) is returned instead of a
 * string, preserving type fidelity for connectors that expect structured input.
 */
export function interpolateObject<T>(obj: T, context: WorkflowContext): T {
  if (typeof obj === 'string') {
    // If the whole string is exactly one template expression, return the raw value
    const singleExprMatch = obj.match(/^\{\{\s*([\w.[\]]+)\s*\}\}$/);
    if (singleExprMatch) {
      const value = resolveExpression(singleExprMatch[1], context);
      if (value !== undefined && value !== null) {
        return value as unknown as T;
      }
      return '' as unknown as T;
    }
    return interpolate(obj, context) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, context)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, context);
    }
    return result as unknown as T;
  }
  return obj;
}
