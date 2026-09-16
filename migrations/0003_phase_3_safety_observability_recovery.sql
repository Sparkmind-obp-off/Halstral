PRAGMA foreign_keys = OFF;

CREATE TABLE idempotency_records_phase3 (
  key TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  capability_id TEXT NOT NULL REFERENCES capabilities(id),
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'UNKNOWN')),
  result_id TEXT REFERENCES execution_results(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO idempotency_records_phase3 SELECT * FROM idempotency_records;
DROP TABLE idempotency_records;
ALTER TABLE idempotency_records_phase3 RENAME TO idempotency_records;

PRAGMA foreign_keys = ON;

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  task_id TEXT REFERENCES tasks(id),
  run_id TEXT REFERENCES runs(id),
  category TEXT NOT NULL CHECK (category IN ('TRANSIENT','VALIDATION','AUTHORIZATION','CREDENTIAL','EXTERNAL_SERVICE','TIMEOUT','CANCELLED','SYSTEM','UNKNOWN','CRITICAL')),
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','MITIGATED','RESOLVED','CLOSED')),
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE safe_stops (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('STEP','RUN','TASK','CAPABILITY','WORKSPACE','CORE')),
  scope_id TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id),
  reason TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  triggered_by TEXT NOT NULL,
  triggered_at TEXT NOT NULL,
  released_by TEXT,
  released_at TEXT
);

CREATE UNIQUE INDEX idx_safe_stops_active_scope ON safe_stops(scope, scope_id) WHERE active = 1;
CREATE INDEX idx_safe_stops_workspace ON safe_stops(workspace_id, active);

CREATE TABLE recovery_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  run_id TEXT NOT NULL REFERENCES runs(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('NOT_STARTED','KNOWN_FAILURE','UNKNOWN','COMPLETED','FAILED','CANCELLED')),
  status TEXT NOT NULL CHECK (status IN ('STARTED','COMPLETED','BLOCKED')),
  strategy TEXT NOT NULL CHECK (strategy IN ('REPLAY_IDEMPOTENT','RETURN_RECORDED_RESULT','MANUAL_REVIEW')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_recovery_workspace ON recovery_records(workspace_id, created_at);
CREATE INDEX idx_recovery_run ON recovery_records(run_id, created_at);

CREATE TABLE telemetry (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id),
  run_id TEXT REFERENCES runs(id),
  workspace_id TEXT REFERENCES workspaces(id),
  capability_id TEXT REFERENCES capabilities(id),
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  status TEXT NOT NULL,
  error_class TEXT CHECK (error_class IS NULL OR error_class IN ('TRANSIENT','VALIDATION','AUTHORIZATION','CREDENTIAL','EXTERNAL_SERVICE','TIMEOUT','CANCELLED','SYSTEM','UNKNOWN','CRITICAL')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  policy_outcome TEXT NOT NULL CHECK (policy_outcome IN ('ALLOW','DENY','NOT_EVALUATED')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_telemetry_correlation ON telemetry(correlation_id, timestamp);
CREATE INDEX idx_telemetry_workspace ON telemetry(workspace_id, timestamp);
CREATE INDEX idx_incidents_workspace ON incidents(workspace_id, status, detected_at);
