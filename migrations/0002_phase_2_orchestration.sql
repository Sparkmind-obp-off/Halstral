PRAGMA foreign_keys = OFF;

CREATE TABLE capabilities_phase2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_scope TEXT NOT NULL CHECK (owner_scope IN ('CORE', 'WORKSPACE')),
  workspace_id TEXT REFERENCES workspaces(id),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  input_schema TEXT NOT NULL DEFAULT '{}',
  output_schema TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED', 'DEPRECATED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((owner_scope = 'CORE' AND workspace_id IS NULL) OR (owner_scope = 'WORKSPACE' AND workspace_id IS NOT NULL))
);
INSERT INTO capabilities_phase2 SELECT * FROM capabilities;
DROP TABLE capabilities;
ALTER TABLE capabilities_phase2 RENAME TO capabilities;

CREATE TABLE tasks_phase2 (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CLASSIFIED', 'PLANNED', 'AUTHORIZED', 'DELEGATED', 'DISPATCHED', 'RUNNING', 'RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  capability_id TEXT REFERENCES capabilities(id),
  credential_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (credential_ref IS NULL OR credential_ref LIKE 'secret://workspace/%')
);
INSERT INTO tasks_phase2 SELECT * FROM tasks;

CREATE TABLE runs_phase2 (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks_phase2(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'DISPATCHED', 'RUNNING', 'RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  idempotency_key TEXT,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO runs_phase2 (id,task_id,workspace_id,status,attempt,idempotency_key,started_at,completed_at,error,created_at,updated_at)
SELECT id,task_id,workspace_id,status,0,NULL,started_at,completed_at,error,created_at,updated_at FROM runs;

DROP TABLE runs;
DROP TABLE tasks;
ALTER TABLE tasks_phase2 RENAME TO tasks;
ALTER TABLE runs_phase2 RENAME TO runs;

CREATE TABLE execution_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  steps TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'AWAITING_APPROVAL', 'AUTHORIZED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED')),
  overall_timeout_seconds INTEGER NOT NULL CHECK (overall_timeout_seconds BETWEEN 1 AND 1800),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE execution_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  run_id TEXT NOT NULL REFERENCES runs(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
  output TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  key TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  result_id TEXT REFERENCES execution_results(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_capabilities_workspace ON capabilities(workspace_id);
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_runs_workspace ON runs(workspace_id);
CREATE UNIQUE INDEX idx_runs_idempotency ON runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_plans_task ON execution_plans(task_id, created_at);
CREATE INDEX idx_plans_workspace ON execution_plans(workspace_id, created_at);
CREATE INDEX idx_results_task ON execution_results(task_id, created_at);
CREATE INDEX idx_results_workspace ON execution_results(workspace_id, created_at);

PRAGMA foreign_keys = ON;
