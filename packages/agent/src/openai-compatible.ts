import { AIProvider, ChatCompletionOptions, ChatCompletionResult } from './provider';

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.openai.com/v1'
  ) {}

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
    };

    if (options.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;
    if (options.temperature !== undefined) body['temperature'] = options.temperature;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0]?.message?.content ?? '';

    return {
      content,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
