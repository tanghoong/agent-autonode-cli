import { z } from 'zod';

export function parseJsonOutput<T>(content: string, schema?: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try extracting JSON from markdown code blocks
    const match = content.match(/```(?:json)?[ \t]*\n([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error(`Failed to parse JSON output: ${content}`);
      }
    } else {
      throw new Error(`Failed to parse JSON output: ${content}`);
    }
  }

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`JSON output validation failed: ${result.error.message}`);
    }
    return result.data;
  }

  return parsed as T;
}
