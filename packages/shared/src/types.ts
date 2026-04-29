export enum ConnectorType {
  HttpRequest = 'http.request',
  Log = 'log',
  Condition = 'condition',
  TransformJson = 'transform.json',
  AgentPrompt = 'agent.prompt',
  FileRead = 'file.read',
  FileWrite = 'file.write',
  WebhookTrigger = 'webhook.trigger',
  ScheduleTrigger = 'schedule.trigger',
}

export interface TriggerDefinition {
  type: string;
  with?: Record<string, unknown>;
}

export interface RetryConfig {
  attempts: number;
  delay?: number;
}

export interface StepDefinition {
  id: string;
  type: string;
  with?: Record<string, unknown>;
  retry?: RetryConfig;
  timeout?: number;
  condition?: string;
}

export interface WorkflowDefinition {
  name: string;
  trigger?: TriggerDefinition;
  steps: StepDefinition[];
}

export interface WorkflowContext {
  trigger: {
    body: Record<string, unknown>;
    headers: Record<string, string>;
    query: Record<string, string>;
  };
  steps: Record<string, StepResult>;
  env: Record<string, string>;
  secrets: Record<string, string>;
}

export interface StepResult {
  status?: number;
  body?: unknown;
  output?: unknown;
  error?: string;
  [key: string]: unknown;
}

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface RunRecord {
  id: string;
  workflowName: string;
  status: RunStatus;
  triggerType: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface StepRecord {
  id: string;
  runId: string;
  stepId: string;
  stepType: string;
  status: RunStatus;
  input?: string;
  output?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
