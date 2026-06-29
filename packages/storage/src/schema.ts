// Database schema definitions for Autonode storage
// Using better-sqlite3 directly (no ORM)

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS step_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input TEXT,
  output TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT,
  FOREIGN KEY (run_id) REFERENCES workflow_runs(id)
);

CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  headers TEXT,
  body TEXT,
  received_at TEXT NOT NULL
);
`;
