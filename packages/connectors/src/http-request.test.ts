import { describe, it, expect, vi, afterEach } from 'vitest';
import { httpRequest } from './http-request';
import { WorkflowContext } from '@taskpipe/shared';

const emptyContext: WorkflowContext = {
  trigger: { body: {}, headers: {}, query: {} },
  steps: {},
  env: {},
  secrets: {},
};

describe('http.request connector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when url is missing', async () => {
    await expect(httpRequest({}, emptyContext)).rejects.toThrow(/url is required/);
  });

  it('makes a GET request and returns status + body', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const result = await httpRequest({ url: 'https://example.com/api' }, emptyContext);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it('makes a POST request with body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } })
    );

    await httpRequest(
      { url: 'https://example.com/api', method: 'POST', body: { name: 'Alice' } },
      emptyContext
    );

    const [, options] = fetchSpy.mock.calls[0];
    expect((options as RequestInit).method).toBe('POST');
    expect((options as RequestInit).body).toBe('{"name":"Alice"}');
  });

  it('appends query parameters to the URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    );

    await httpRequest(
      { url: 'https://example.com/search', query: { q: 'hello', page: '1' } },
      emptyContext
    );

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('q=hello');
    expect(String(url)).toContain('page=1');
  });

  it('returns plain text body when content-type is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('plain text', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    );

    const result = await httpRequest({ url: 'https://example.com' }, emptyContext);
    expect(result.body).toBe('plain text');
  });

  it('wraps network errors with a user-friendly message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(httpRequest({ url: 'https://example.com' }, emptyContext)).rejects.toThrow(
      /Network error/
    );
  });

  it('throws a timeout error when the request is aborted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, options) => {
      // Immediately trigger abort
      (options as RequestInit).signal?.addEventListener('abort', () => {});
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(
      httpRequest({ url: 'https://example.com', timeout: 1 }, emptyContext)
    ).rejects.toThrow(/timed out/);
  });
});
