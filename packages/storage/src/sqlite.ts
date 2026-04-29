import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CREATE_TABLES_SQL } from './schema';
import { RunRecord, StepRecord, RunStatus } from '@taskpipe/shared';

const DEFAULT_DB_DIR = path.join(os.homedir(), '.taskpipe');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'taskpipe.db');

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class TaskPipeStorage {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.exec(CREATE_TABLES_SQL);
  }

  // Workflow runs
  createRun(workflowName: string, triggerType = 'manual'): RunRecord {
    const run: RunRecord = {
      id: generateId(),
      workflowName,
      status: 'pending',
      triggerType,
      startedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO workflow_runs (id, workflow_name, status, trigger_type, started_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(run.id, run.workflowName, run.status, run.triggerType, run.startedAt);
    return run;
  }

  updateRun(id: string, status: RunStatus, error?: string): void {
    const completedAt = ['success', 'failed'].includes(status) ? new Date().toISOString() : undefined;
    this.db
      .prepare('UPDATE workflow_runs SET status = ?, completed_at = ?, error = ? WHERE id = ?')
      .run(status, completedAt ?? null, error ?? null, id);
  }

  getRun(id: string): RunRecord | undefined {
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as Record<string, string> | undefined;
    if (!row) return undefined;
    return this.rowToRun(row);
  }

  listRuns(limit = 20): RunRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_runs ORDER BY started_at DESC LIMIT ?')
      .all(limit) as Record<string, string>[];
    return rows.map(r => this.rowToRun(r));
  }

  private rowToRun(row: Record<string, string>): RunRecord {
    return {
      id: row['id'],
      workflowName: row['workflow_name'],
      status: row['status'] as RunStatus,
      triggerType: row['trigger_type'],
      startedAt: row['started_at'],
      completedAt: row['completed_at'] ?? undefined,
      error: row['error'] ?? undefined,
    };
  }

  // Step runs
  createStepRun(runId: string, stepId: string, stepType: string, input?: unknown): StepRecord {
    const stepRun: StepRecord = {
      id: generateId(),
      runId,
      stepId,
      stepType,
      status: 'running',
      input: input !== undefined ? JSON.stringify(input) : undefined,
      startedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO step_runs (id, run_id, step_id, step_type, status, input, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(stepRun.id, stepRun.runId, stepRun.stepId, stepRun.stepType, stepRun.status, stepRun.input ?? null, stepRun.startedAt);
    return stepRun;
  }

  updateStepRun(id: string, status: RunStatus, output?: unknown, error?: string): void {
    const completedAt = new Date().toISOString();
    const outputStr = output !== undefined ? JSON.stringify(output) : null;
    this.db
      .prepare('UPDATE step_runs SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ?')
      .run(status, outputStr, error ?? null, completedAt, id);
  }

  listStepRuns(runId: string): StepRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM step_runs WHERE run_id = ? ORDER BY started_at ASC')
      .all(runId) as Record<string, string>[];
    return rows.map(r => ({
      id: r['id'],
      runId: r['run_id'],
      stepId: r['step_id'],
      stepType: r['step_type'],
      status: r['status'] as RunStatus,
      input: r['input'] ?? undefined,
      output: r['output'] ?? undefined,
      startedAt: r['started_at'],
      completedAt: r['completed_at'] ?? undefined,
      error: r['error'] ?? undefined,
    }));
  }

  // Webhook events
  saveWebhookEvent(eventPath: string, method: string, headers: unknown, body: unknown): string {
    const id = generateId();
    this.db
      .prepare('INSERT INTO webhook_events (id, path, method, headers, body, received_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, eventPath, method, JSON.stringify(headers), JSON.stringify(body), new Date().toISOString());
    return id;
  }

  close(): void {
    this.db.close();
  }
}

export { DEFAULT_DB_PATH, DEFAULT_DB_DIR };
