import { WorkflowContext, StepResult } from '@taskpipe/shared';

interface TransformJsonConfig {
  input: unknown;
  template?: Record<string, unknown> | string;
  expression?: string;
}

function applyTemplate(template: unknown, input: unknown): unknown {
  if (typeof template === 'string') {
    return template.replace(/\$\.([\w.[\]]+)/g, (_match: string, path: string) => {
      const parts = path.split('.');
      let current: unknown = input;
      for (const part of parts) {
        if (current === null || current === undefined) return '';
        current = (current as Record<string, unknown>)[part];
      }
      return current === undefined ? '' : String(current);
    });
  }
  if (Array.isArray(template)) {
    return template.map((item: unknown) => applyTemplate(item, input));
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
      result[key] = applyTemplate(value, input);
    }
    return result;
  }
  return template;
}

export async function transformJson(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { input, template } = config as unknown as TransformJsonConfig;

  if (template !== undefined) {
    const result = applyTemplate(template, input);
    return { output: result };
  }

  return { output: input };
}
