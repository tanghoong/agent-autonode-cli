import { WorkflowContext } from '@taskpipe/shared';

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function interpolate(template: string, context: WorkflowContext): string {
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (match, path: string) => {
    const parts = path.split('.');
    const root = parts[0];
    const rest = parts.slice(1);

    let value: unknown;

    if (root === 'trigger') {
      value = getNestedValue(context.trigger, rest);
    } else if (root === 'steps') {
      value = getNestedValue(context.steps, rest);
    } else if (root === 'env') {
      value = rest.length > 0 ? context.env[rest[0]] : undefined;
    } else if (root === 'secrets') {
      value = rest.length > 0 ? context.secrets[rest[0]] : undefined;
    } else {
      return match;
    }

    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

export function interpolateObject<T>(obj: T, context: WorkflowContext): T {
  if (typeof obj === 'string') {
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
