export class TaskPipeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TaskPipeError';
  }
}

export class ParseError extends TaskPipeError {
  constructor(message: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}

export class ValidationError extends TaskPipeError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends TaskPipeError {
  constructor(message: string, public readonly stepId?: string) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
  }
}

export class TimeoutError extends TaskPipeError {
  constructor(stepId: string, timeoutMs: number) {
    super(`Step '${stepId}' timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

export class ConnectorNotFoundError extends TaskPipeError {
  constructor(connectorType: string) {
    super(`Connector '${connectorType}' not found`, 'CONNECTOR_NOT_FOUND');
    this.name = 'ConnectorNotFoundError';
  }
}
