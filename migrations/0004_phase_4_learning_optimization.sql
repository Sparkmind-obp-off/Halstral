PRAGMA foreign_keys = ON;

CREATE TABLE outcome_records (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), task_id TEXT NOT NULL REFERENCES tasks(id), run_id TEXT NOT NULL REFERENCES runs(id), capability_id TEXT NOT NULL REFERENCES capabilities(id), version_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('SUCCEEDED','FAILED','CANCELLED','BLOCKED','RECOVERED')), started_at TEXT NOT NULL, completed_at TEXT NOT NULL, duration_ms INTEGER NOT NULL CHECK(duration_ms>=0), attempts INTEGER NOT NULL CHECK(attempts>=0), retries INTEGER NOT NULL CHECK(retries>=0),
 policy_outcome TEXT NOT NULL CHECK(policy_outcome IN ('ALLOW','DENY','NOT_EVALUATED')), error_class TEXT, metrics TEXT NOT NULL DEFAULT '{}', source_type TEXT NOT NULL CHECK(source_type IN ('EXECUTION_RESULT','RUN','RECOVERY')), source_id TEXT NOT NULL, verified INTEGER NOT NULL CHECK(verified IN (0,1)), captured_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_outcome_source ON outcome_records(workspace_id,source_type,source_id);
CREATE INDEX idx_outcome_target_version ON outcome_records(workspace_id,capability_id,version_id,captured_at);

CREATE TABLE learning_signals (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), target_type TEXT NOT NULL CHECK(target_type IN ('CAPABILITY','WORKFLOW')), target_id TEXT NOT NULL, version_id TEXT NOT NULL, signal_type TEXT NOT NULL, value REAL NOT NULL, sample_size INTEGER NOT NULL CHECK(sample_size>0), outcome_refs TEXT NOT NULL, validation_status TEXT NOT NULL CHECK(validation_status IN ('UNVERIFIED','VERIFIED','REJECTED')), confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1), created_at TEXT NOT NULL
);
CREATE INDEX idx_signals_target ON learning_signals(workspace_id,target_type,target_id,created_at);

CREATE TABLE configuration_revisions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), target_type TEXT NOT NULL CHECK(target_type IN ('CAPABILITY','WORKFLOW')), target_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0), config TEXT NOT NULL, previous_revision_id TEXT REFERENCES configuration_revisions(id), proposal_id TEXT, status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVERTED','DISABLED')), created_at TEXT NOT NULL, activated_at TEXT,
 UNIQUE(workspace_id,target_type,target_id,version)
);
CREATE UNIQUE INDEX idx_revision_active ON configuration_revisions(workspace_id,target_type,target_id) WHERE status='ACTIVE';

CREATE TABLE optimization_proposals (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), target_type TEXT NOT NULL CHECK(target_type IN ('CAPABILITY','WORKFLOW')), target_id TEXT NOT NULL, reason TEXT NOT NULL, evidence_refs TEXT NOT NULL, current_config TEXT NOT NULL, proposed_config TEXT NOT NULL, expected_effect TEXT NOT NULL, risk_class TEXT NOT NULL CHECK(risk_class IN ('LOW','MEDIUM','HIGH','CRITICAL')), status TEXT NOT NULL CHECK(status IN ('DRAFT','PENDING_REVIEW','APPROVED','APPLIED','REJECTED','REVERTED','DISABLED')), base_revision_id TEXT REFERENCES configuration_revisions(id), applied_revision_id TEXT REFERENCES configuration_revisions(id), approval_ref TEXT, created_at TEXT NOT NULL, reviewed_at TEXT, applied_at TEXT, reverted_at TEXT, updated_at TEXT
);
CREATE INDEX idx_proposals_workspace_status ON optimization_proposals(workspace_id,status,created_at);

CREATE TABLE performance_measurements (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), target_type TEXT NOT NULL CHECK(target_type IN ('CAPABILITY','WORKFLOW')), target_id TEXT NOT NULL, version_id TEXT NOT NULL, period TEXT NOT NULL CHECK(period IN ('BASELINE','POST_CHANGE')), outcome_refs TEXT NOT NULL, metrics TEXT NOT NULL, measured_at TEXT NOT NULL
);
CREATE INDEX idx_measurements_target ON performance_measurements(workspace_id,target_type,target_id,measured_at);

CREATE TABLE capability_promotions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), capability_id TEXT NOT NULL REFERENCES capabilities(id), owner_id TEXT NOT NULL, provenance_refs TEXT NOT NULL, performance_measurement_ids TEXT NOT NULL, security_contract TEXT NOT NULL, scope TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('PROPOSED','APPROVED','PROMOTED','REJECTED','DISABLED')), approval_ref TEXT, created_at TEXT NOT NULL, reviewed_at TEXT, promoted_at TEXT, updated_at TEXT
);
CREATE INDEX idx_promotions_workspace_status ON capability_promotions(workspace_id,status,created_at);
