import { WorkflowContext, StepResult } from '@taskpipe/shared';

interface AgentPromptConfig {
  model?: string;
  prompt: string;
  systemPrompt?: string;
  output?: {
    format: 'text' | 'json';
    schema?: Record<string, unknown>;
  };
  baseUrl?: string;
  apiKey?: string;
}

export async function agentPrompt(
  config: Record<string, unknown>,
  context: WorkflowContext
): Promise<StepResult> {
  const {
    model = 'gpt-4.1-mini',
    prompt,
    systemPrompt,
    output = { format: 'text' },
    baseUrl,
    apiKey,
  } = config as unknown as AgentPromptConfig;

  if (!prompt) throw new Error('agent.prompt: prompt is required');

  const resolvedApiKey = apiKey ?? context.secrets['OPENAI_API_KEY'] ?? context.env['OPENAI_API_KEY'];
  const resolvedBaseUrl = baseUrl ?? context.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1';

  if (!resolvedApiKey) {
    throw new Error('agent.prompt: OPENAI_API_KEY is required (set as secret or env var)');
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const requestBody: Record<string, unknown> = {
    model,
    messages,
  };

  if (output.format === 'json') {
    requestBody['response_format'] = { type: 'json_object' };
  }

  const response = await fetch(`${resolvedBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`agent.prompt: API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content ?? '';

  if (output.format === 'json') {
    try {
      return { output: JSON.parse(content) };
    } catch {
      return { output: content };
    }
  }

  return { output: content };
}
