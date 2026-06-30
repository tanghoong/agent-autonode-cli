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

export interface ForEachConfig {
  /** A template expression resolving to an array, or an inline array. */
  items: string | unknown[];
  /** Name the current item is bound to inside the loop body (default: `item`). */
  as?: string;
  /** Max items processed concurrently (default: 1 = sequential). */
  concurrency?: number;
  /** Sub-pipeline run once per item. */
  steps: StepDefinition[];
}

export interface StepDefinition {
  id: string;
  /** Connector type for a normal step. Omitted for a parallel group / forEach. */
  type?: string;
  with?: Record<string, unknown>;
  retry?: RetryConfig;
  timeout?: number;
  condition?: string;
  /** Child steps to run concurrently. A step sets exactly one of type/parallel/forEach. */
  parallel?: StepDefinition[];
  /** Run a sub-pipeline once per item of a runtime array. */
  forEach?: ForEachConfig;
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
  /** Loop-scoped variables (e.g. the current `forEach` item), if any. */
  vars?: Record<string, unknown>;
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
