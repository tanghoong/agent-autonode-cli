import { z } from 'zod';

const RetryConfigSchema = z.object({
  attempts: z.number().int().positive(),
  delay: z.number().int().nonnegative().optional(),
});

const TriggerDefinitionSchema = z.object({
  type: z.string(),
  with: z.record(z.unknown()).optional(),
});

const StepDefinitionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Step ID must be a valid identifier'),
  type: z.string(),
  with: z.record(z.unknown()).optional(),
  retry: RetryConfigSchema.optional(),
  timeout: z.number().int().positive().optional(),
  condition: z.string().optional(),
});

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  trigger: TriggerDefinitionSchema.optional(),
  steps: z.array(StepDefinitionSchema).min(1),
});

export type WorkflowSchemaType = z.infer<typeof WorkflowSchema>;
