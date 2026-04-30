import { describe, it, expect } from 'vitest';
import { parseWorkflowYaml } from './parser';
import { ParseError } from './errors';

describe('parseWorkflowYaml', () => {
  it('parses a valid minimal workflow', () => {
    const yaml = `
name: my-workflow
steps:
  - id: step1
    type: log
    with:
      message: hello
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.name).toBe('my-workflow');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe('step1');
  });

  it('parses a workflow with trigger', () => {
    const yaml = `
name: scheduled
trigger:
  type: schedule.trigger
  with:
    cron: "0 9 * * *"
steps:
  - id: step1
    type: log
    with:
      message: running
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.trigger?.type).toBe('schedule.trigger');
    expect(result.trigger?.with?.['cron']).toBe('0 9 * * *');
  });

  it('throws ParseError for invalid YAML', () => {
    expect(() => parseWorkflowYaml(':\ninvalid: [unclosed')).toThrow(ParseError);
  });

  it('throws ParseError for empty document', () => {
    expect(() => parseWorkflowYaml('')).toThrow(ParseError);
  });

  it('throws ParseError for non-object YAML (array at root)', () => {
    expect(() => parseWorkflowYaml('- a\n- b')).toThrow(ParseError);
  });
});
