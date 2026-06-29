import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileRead } from './file-read';
import { fileWrite } from './file-write';
import { WorkflowContext } from '@autonode/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

describe('file.read connector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonode-test-'));
    // Make cwd point to tmpDir so absolute paths within it pass the traversal check
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a file and returns its contents', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');

    const result = await fileRead({ path: filePath }, emptyContext);
    expect(result.output).toBe('hello world');
  });

  it('reads a file using a relative path', async () => {
    fs.writeFileSync(path.join(tmpDir, 'rel.txt'), 'relative');
    const result = await fileRead({ path: 'rel.txt' }, emptyContext);
    expect(result.output).toBe('relative');
  });

  it('throws when path is missing', async () => {
    await expect(fileRead({}, emptyContext)).rejects.toThrow(/path is required/);
  });

  it('throws on null bytes in path', async () => {
    await expect(fileRead({ path: 'file\0evil' }, emptyContext)).rejects.toThrow(/null bytes/);
  });

  it('throws on path traversal outside cwd', async () => {
    await expect(fileRead({ path: '../../etc/passwd' }, emptyContext)).rejects.toThrow(
      /must stay within the current working directory/
    );
  });

  it('throws when file does not exist', async () => {
    await expect(fileRead({ path: 'nonexistent.txt' }, emptyContext)).rejects.toThrow();
  });
});

describe('file.write connector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonode-test-'));
    // Make cwd point to tmpDir so relative paths resolve there
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes content to a file using a relative path', async () => {
    const result = await fileWrite({ path: 'output.txt', content: 'written content' }, emptyContext);
    const expectedPath = path.join(tmpDir, 'output.txt');
    expect(result.output).toBe(expectedPath);
    expect(fs.readFileSync(expectedPath, 'utf-8')).toBe('written content');
  });

  it('creates parent directories if they do not exist', async () => {
    await fileWrite({ path: 'nested/dir/file.txt', content: 'nested' }, emptyContext);
    expect(fs.existsSync(path.join(tmpDir, 'nested', 'dir', 'file.txt'))).toBe(true);
  });

  it('appends content when append=true', async () => {
    fs.writeFileSync(path.join(tmpDir, 'append.txt'), 'first');
    await fileWrite({ path: 'append.txt', content: 'second', append: true }, emptyContext);
    expect(fs.readFileSync(path.join(tmpDir, 'append.txt'), 'utf-8')).toBe('firstsecond');
  });

  it('throws when path is missing', async () => {
    await expect(fileWrite({ content: 'data' }, emptyContext)).rejects.toThrow(/path is required/);
  });

  it('throws when content is missing', async () => {
    await expect(fileWrite({ path: 'x.txt' }, emptyContext)).rejects.toThrow(/content is required/);
  });

  it('throws on null bytes in path', async () => {
    await expect(
      fileWrite({ path: 'evil\0file', content: 'x' }, emptyContext)
    ).rejects.toThrow(/null bytes/);
  });

  it('throws on absolute paths', async () => {
    await expect(
      fileWrite({ path: '/etc/passwd', content: 'x' }, emptyContext)
    ).rejects.toThrow(/absolute paths are not allowed/);
  });

  it('throws on path traversal outside cwd', async () => {
    await expect(
      fileWrite({ path: '../../etc/passwd', content: 'x' }, emptyContext)
    ).rejects.toThrow(/must stay within the working directory/);
  });
});
