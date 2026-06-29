import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { WorkflowDefinition } from '@autonode/shared';
import { ParseError } from './errors';

export function parseWorkflowFile(filePath: string): WorkflowDefinition {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new ParseError(`Failed to read file '${filePath}': ${(err as Error).message}`);
  }
  return parseWorkflowYaml(content);
}

export function parseWorkflowYaml(yamlContent: string): WorkflowDefinition {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlContent);
  } catch (err) {
    throw new ParseError(`Failed to parse YAML: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ParseError('Workflow YAML must be a non-empty object');
  }

  return parsed as WorkflowDefinition;
}
