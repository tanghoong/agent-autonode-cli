import { WorkflowContext, StepResult } from '@taskpipe/shared';

interface HttpRequestConfig {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export async function httpRequest(
  config: Record<string, unknown>,
  _context: WorkflowContext
): Promise<StepResult> {
  const { method = 'GET', url, headers = {}, body, query } = config as unknown as HttpRequestConfig;

  if (!url) throw new Error('http.request: url is required');

  let fullUrl = url;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    const separator = url.includes('?') ? '&' : '?';
    fullUrl = `${url}${separator}${params.toString()}`;
  }

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  if (body && method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(fullUrl, fetchOptions);
  const responseText = await response.text();

  let responseBody: unknown;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = responseText;
  }

  return {
    status: response.status,
    body: responseBody,
    headers: Object.fromEntries(response.headers.entries()),
  };
}
