import { WorkflowContext, StepResult } from '@autonode/shared';
import * as fs from 'fs';
import * as path from 'path';

interface FileReadConfig {
  path: string;
  encoding?: BufferEncoding;
}

/**
 * Resolves and validates a file path to prevent directory traversal attacks.
 * The resolved path must not contain null bytes and must remain within the
 * current working directory after resolution.
 */
function safeResolvePath(filePath: string): string {
  if (filePath.includes('\0')) {
    throw new Error('file.read: path must not contain null bytes');
  }

  const baseDir = path.resolve(process.cwd());
  const resolvedPath = path.resolve(baseDir, filePath);
  const relativePath = path.relative(baseDir, resolvedPath);

  if (relativePath.startsWith('..')) {
    throw new Error('file.read: path must stay within the current working directory');
  }

  return resolvedPath;
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
