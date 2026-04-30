import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileRead } from './file-read';
import { fileWrite } from './file-write';
import { WorkflowContext } from '@taskpipe/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

describe('file.read connector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskpipe-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a file and returns its contents', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');

    const result = await fileRead({ path: filePath }, emptyContext);
    expect(result.output).toBe('hello world');
  });

  it('throws when path is missing', async () => {
    await expect(fileRead({}, emptyContext)).rejects.toThrow(/path is required/);
  });

  it('throws on null bytes in path', async () => {
    await expect(fileRead({ path: '/tmp/file\0evil' }, emptyContext)).rejects.toThrow(/null bytes/);
  });

  it('throws when file does not exist', async () => {
    await expect(
      fileRead({ path: path.join(tmpDir, 'nonexistent.txt') }, emptyContext)
    ).rejects.toThrow();
  });
});

describe('file.write connector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskpipe-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes content to a file and returns the resolved path', async () => {
    const filePath = path.join(tmpDir, 'output.txt');
    const result = await fileWrite({ path: filePath, content: 'written content' }, emptyContext);
    expect(result.output).toBe(filePath);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('written content');
  });

  it('creates parent directories if they do not exist', async () => {
    const filePath = path.join(tmpDir, 'nested', 'dir', 'file.txt');
    await fileWrite({ path: filePath, content: 'nested' }, emptyContext);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('appends content when append=true', async () => {
    const filePath = path.join(tmpDir, 'append.txt');
    fs.writeFileSync(filePath, 'first');
    await fileWrite({ path: filePath, content: 'second', append: true }, emptyContext);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('firstsecond');
  });

  it('throws when path is missing', async () => {
    await expect(fileWrite({ content: 'data' }, emptyContext)).rejects.toThrow(/path is required/);
  });

  it('throws when content is missing', async () => {
    const filePath = path.join(tmpDir, 'x.txt');
    await expect(fileWrite({ path: filePath }, emptyContext)).rejects.toThrow(/content is required/);
  });

  it('throws on null bytes in path', async () => {
    await expect(
      fileWrite({ path: '/tmp/evil\0file', content: 'x' }, emptyContext)
    ).rejects.toThrow(/null bytes/);
  });
});
