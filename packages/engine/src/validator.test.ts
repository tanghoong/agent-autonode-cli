import { describe, it, expect } from 'vitest';
import { validateWorkflow } from './validator';
import { ValidationError } from './errors';

const validWorkflow = {
  name: 'test-wf',
  steps: [{ id: 'step1', type: 'log', with: { message: 'hi' } }],
};

describe('validateWorkflow', () => {
  it('accepts a valid workflow', () => {
    const result = validateWorkflow(validWorkflow);
    expect(result.name).toBe('test-wf');
    expect(result.steps).toHaveLength(1);
  });

  it('throws ValidationError when name is missing', () => {
    expect(() => validateWorkflow({ steps: [{ id: 'step1', type: 'log' }] })).toThrow(ValidationError);
  });

  it('throws ValidationError when steps array is empty', () => {
    expect(() => validateWorkflow({ name: 'test', steps: [] })).toThrow(ValidationError);
  });

  it('throws ValidationError when steps is missing', () => {
    expect(() => validateWorkflow({ name: 'test' })).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid step ID (contains spaces)', () => {
    expect(() =>
      validateWorkflow({ name: 'test', steps: [{ id: 'bad id', type: 'log' }] })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid step ID (starts with digit)', () => {
    expect(() =>
      validateWorkflow({ name: 'test', steps: [{ id: '1step', type: 'log' }] })
    ).toThrow(ValidationError);
  });

  it('accepts a workflow with retry configuration', () => {
    const wf = {
      name: 'retry-wf',
      steps: [{ id: 'step1', type: 'http.request', retry: { attempts: 3, delay: 1000 } }],
    };
    const result = validateWorkflow(wf);
    expect(result.steps[0].retry?.attempts).toBe(3);
  });

  it('accepts a workflow with timeout', () => {
    const wf = {
      name: 'timeout-wf',
      steps: [{ id: 'step1', type: 'http.request', timeout: 5000 }],
    };
    const result = validateWorkflow(wf);
    expect(result.steps[0].timeout).toBe(5000);
  });

  it('accepts a workflow with optional condition', () => {
    const wf = {
      name: 'cond-wf',
      steps: [{ id: 'step1', type: 'log', condition: '{{ steps.prev.output }} == 200' }],
    };
    const result = validateWorkflow(wf);
    expect(result.steps[0].condition).toBe('{{ steps.prev.output }} == 200');
  });

  it('accepts a parallel group step', () => {
    const wf = {
      name: 'par-wf',
      steps: [
        {
          id: 'group',
          parallel: [
            { id: 'a', type: 'log', with: { message: 'a' } },
            { id: 'b', type: 'log', with: { message: 'b' } },
          ],
        },
      ],
    };
    const result = validateWorkflow(wf);
    expect(result.steps[0].parallel).toHaveLength(2);
  });

  it('rejects a step with both type and parallel', () => {
    expect(() =>
      validateWorkflow({
        name: 'bad',
        steps: [{ id: 'group', type: 'log', parallel: [{ id: 'a', type: 'log' }] }],
      })
    ).toThrow(ValidationError);
  });

  it('rejects a step with neither type nor parallel', () => {
    expect(() =>
      validateWorkflow({ name: 'bad', steps: [{ id: 'orphan' }] })
    ).toThrow(ValidationError);
  });

  it('rejects an empty parallel group', () => {
    expect(() =>
      validateWorkflow({ name: 'bad', steps: [{ id: 'group', parallel: [] }] })
    ).toThrow(ValidationError);
  });
});
