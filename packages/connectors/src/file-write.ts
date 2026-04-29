import { WorkflowContext, StepResult } from '@taskpipe/shared';
import * as fs from 'fs';
import * as path from 'path';

interface FileWriteConfig {
  path: string;
  content: string;
  encoding?: BufferEncoding;
  append?: boolean;
}

export async function fileWrite(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { path: filePath, content, encoding = 'utf-8', append = false } = config as unknown as FileWriteConfig;
  if (!filePath) throw new Error('file.write: path is required');
  if (content === undefined) throw new Error('file.write: content is required');

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (append) {
    fs.appendFileSync(filePath, content, encoding);
  } else {
    fs.writeFileSync(filePath, content, encoding);
  }

  return { output: filePath };
}
