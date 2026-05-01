import { WorkflowContext, StepResult } from '@taskpipe/shared';
import * as fs from 'fs';
import * as path from 'path';

interface FileWriteConfig {
  path: string;
  content: string;
  encoding?: BufferEncoding;
  append?: boolean;
}

/**
 * Resolves and validates a file path to prevent directory traversal attacks.
 * The resolved path must not contain null bytes and must stay within the
 * current working directory.
 */
function safeResolvePath(filePath: string): string {
  if (filePath.includes('\0')) {
    throw new Error('file.write: path must not contain null bytes');
  }
  if (path.isAbsolute(filePath)) {
    throw new Error('file.write: absolute paths are not allowed');
  }

  const allowedRoot = path.resolve(process.cwd());
  const resolvedPath = path.resolve(allowedRoot, filePath);
  const relativePath = path.relative(allowedRoot, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('file.write: path must stay within the working directory');
  }

  return resolvedPath;
}

export async function fileWrite(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { path: filePath, content, encoding = 'utf-8', append = false } = config as unknown as FileWriteConfig;
  if (!filePath) throw new Error('file.write: path is required');
  if (content === undefined) throw new Error('file.write: content is required');

  const resolvedPath = safeResolvePath(filePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (append) {
    fs.appendFileSync(resolvedPath, content, encoding);
  } else {
    fs.writeFileSync(resolvedPath, content, encoding);
  }

  return { output: resolvedPath };
}
