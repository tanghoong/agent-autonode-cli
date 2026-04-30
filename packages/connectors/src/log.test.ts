import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logConnector } from './log';
import { logger } from '@taskpipe/shared';
import { WorkflowContext } from '@taskpipe/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

describe('log connector', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the message as output', async () => {
    const result = await logConnector({ message: 'hello world' }, emptyContext);
    expect(result.output).toBe('hello world');
  });

  it('calls logger.info by default', async () => {
    await logConnector({ message: 'test message' }, emptyContext);
    expect(logger.info).toHaveBeenCalledWith('test message');
  });

  it('calls logger.warn when level is warn', async () => {
    await logConnector({ message: 'warning', level: 'warn' }, emptyContext);
    expect(logger.warn).toHaveBeenCalledWith('warning');
  });

  it('calls logger.error when level is error', async () => {
    await logConnector({ message: 'error occurred', level: 'error' }, emptyContext);
    expect(logger.error).toHaveBeenCalledWith('error occurred');
  });

  it('throws when message is missing', async () => {
    await expect(logConnector({}, emptyContext)).rejects.toThrow(/message is required/);
  });
});
