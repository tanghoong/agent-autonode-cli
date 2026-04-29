import { AIProvider, ChatMessage, ChatCompletionResult } from './provider';

export interface PromptRunnerOptions {
  provider: AIProvider;
  model: string;
  systemPrompt?: string;
  prompt: string;
  responseFormat?: 'text' | 'json';
  maxTokens?: number;
  temperature?: number;
}

export async function runPrompt(options: PromptRunnerOptions): Promise<ChatCompletionResult> {
  const messages: ChatMessage[] = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: options.prompt });

  return options.provider.chat({
    model: options.model,
    messages,
    responseFormat: options.responseFormat,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });
}
