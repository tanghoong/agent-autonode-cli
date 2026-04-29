import { WorkflowContext, StepResult, logger } from '@taskpipe/shared';

interface LogConfig {
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

export async function logConnector(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { message, level = 'info' } = config as unknown as LogConfig;
  if (!message) throw new Error('log: message is required');

  logger[level](message);

  return { output: message };
}
