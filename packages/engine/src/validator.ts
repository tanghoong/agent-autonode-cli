import { WorkflowSchema } from '@taskpipe/shared';
import { WorkflowDefinition } from '@taskpipe/shared';
import { ValidationError } from './errors';

export function validateWorkflow(workflow: unknown): WorkflowDefinition {
  const result = WorkflowSchema.safeParse(workflow);
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(`Workflow validation failed: ${messages}`, result.error.errors);
  }
  return result.data as WorkflowDefinition;
}
