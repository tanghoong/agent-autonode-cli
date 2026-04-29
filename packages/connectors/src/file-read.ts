import { WorkflowContext, StepResult } from '@taskpipe/shared';
import * as fs from 'fs';

interface FileReadConfig {
  path: string;
  encoding?: BufferEncoding;
}

export async function fileRead(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { path, encoding = 'utf-8' } = config as unknown as FileReadConfig;
  if (!path) throw new Error('file.read: path is required');

  const content = fs.readFileSync(path, encoding);
  return { output: content };
}
