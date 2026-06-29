import { WorkflowContext, StepResult } from '@autonode/shared';

const DEFAULT_TIMEOUT_MS = 30_000;

interface HttpRequestConfig {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
}

export async function httpRequest(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { method = 'GET', url, headers = {}, body, query, timeout = DEFAULT_TIMEOUT_MS } = config as unknown as HttpRequestConfig;

  if (!url) throw new Error('http.request: url is required');

  let fullUrl = url;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    const separator = url.includes('?') ? '&' : '?';
    fullUrl = `${url}${separator}${params.toString()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json', ...headers },
    signal: controller.signal,
  };

  if (body && method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, fetchOptions);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`http.request: Request timed out after ${timeout}ms (url: ${fullUrl})`);
    }
    throw new Error(`http.request: Network error - ${(err as Error).message} (url: ${fullUrl})`);
  }
  clearTimeout(timer);

  const contentType = response.headers.get('content-type') ?? '';
  let responseBody: unknown;
  if (contentType.includes('application/json')) {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    body: responseBody,
    headers: Object.fromEntries(response.headers.entries()),
  };
}
