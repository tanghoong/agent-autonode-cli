import { z } from 'zod';

const RetryConfigSchema = z.object({
  attempts: z.number().int().positive(),
  delay: z.number().int().nonnegative().optional(),
});

const TriggerDefinitionSchema = z.object({
  type: z.string(),
  with: z.record(z.unknown()).optional(),
});

type StepDefinitionInput = {
  id: string;
  type?: string;
  with?: Record<string, unknown>;
  retry?: { attempts: number; delay?: number };
  timeout?: number;
  condition?: string;
  parallel?: StepDefinitionInput[];
  forEach?: {
    items: string | unknown[];
    as?: string;
    concurrency?: number;
    steps: StepDefinitionInput[];
  };
};

const StepDefinitionSchema: z.ZodType<StepDefinitionInput> = z.lazy(() =>
  z
    .object({
      id: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Step ID must be a valid identifier'),
      type: z.string().optional(),
      with: z.record(z.unknown()).optional(),
      retry: RetryConfigSchema.optional(),
      timeout: z.number().int().positive().optional(),
      condition: z.string().optional(),
      // A parallel group runs its child steps concurrently.
      parallel: z.array(StepDefinitionSchema).min(1).optional(),
      // A forEach loop runs its sub-pipeline once per item of a runtime array.
      forEach: z
        .object({
          items: z.union([z.string(), z.array(z.unknown())]),
          as: z.string().optional(),
          concurrency: z.number().int().positive().optional(),
          steps: z.array(StepDefinitionSchema).min(1),
        })
        .optional(),
    })
    .refine(
      step =>
        [step.type, step.parallel, step.forEach].filter(value => value !== undefined).length === 1,
      { message: "a step must set exactly one of 'type', 'parallel', or 'forEach'" }
    )
);

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  trigger: TriggerDefinitionSchema.optional(),
  steps: z.array(StepDefinitionSchema).min(1),
});

export type WorkflowSchemaType = z.infer<typeof WorkflowSchema>;
