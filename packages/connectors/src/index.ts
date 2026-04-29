import { ConnectorType } from '@taskpipe/shared';
import { ConnectorRegistry } from '@taskpipe/engine';
import { httpRequest } from './http-request';
import { logConnector } from './log';
import { condition } from './condition';
import { transformJson } from './transform-json';
import { agentPrompt } from './agent-prompt';
import { fileRead } from './file-read';
import { fileWrite } from './file-write';

export { httpRequest } from './http-request';
export { logConnector } from './log';
export { condition } from './condition';
export { transformJson } from './transform-json';
export { agentPrompt } from './agent-prompt';
export { fileRead } from './file-read';
export { fileWrite } from './file-write';

export function createDefaultRegistry(): ConnectorRegistry {
  const registry = new Map();
  registry.set(ConnectorType.HttpRequest, httpRequest);
  registry.set(ConnectorType.Log, logConnector);
  registry.set(ConnectorType.Condition, condition);
  registry.set(ConnectorType.TransformJson, transformJson);
  registry.set(ConnectorType.AgentPrompt, agentPrompt);
  registry.set(ConnectorType.FileRead, fileRead);
  registry.set(ConnectorType.FileWrite, fileWrite);
  return registry;
}
