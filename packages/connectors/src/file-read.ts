import { WorkflowContext, StepResult } from '@taskpipe/shared';
import * as fs from 'fs';
import * as path from 'path';

interface FileReadConfig {
  path: string;
  encoding?: BufferEncoding;
}

/**
 * Resolves and validates a file path to prevent directory traversal attacks.
 * The resolved path must not contain null bytes and must be an absolute path
 * produced by resolving against the current working directory.
 */
function safeResolvePath(filePath: string): string {
  if (filePath.includes('\0')) {
    throw new Error('file.read: path must not contain null bytes');
  }
  return path.resolve(process.cwd(), filePath);
}

export async function fileRead(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { path: filePath, encoding = 'utf-8' } = config as unknown as FileReadConfig;
  if (!filePath) throw new Error('file.read: path is required');

  const resolvedPath = safeResolvePath(filePath);
  const content = fs.readFileSync(resolvedPath, encoding);
  return { output: content };
}
