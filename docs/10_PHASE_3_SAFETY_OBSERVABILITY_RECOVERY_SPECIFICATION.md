# HALSTRAL — Phase 3 Safety, Observability & Recovery Specification

## 1. Purpose

Phase 2 established governed task orchestration and controlled execution. Phase 3 makes that execution resilient and governable when things go wrong.

Canonical objective:

> Execute safely, observe clearly, fail predictably, recover deliberately.

Phase 3 adds safety controls for timeouts, cancellation, bounded retries, failure classification, concurrency, recovery, safe-stop, incidents, and operational observability while preserving every Phase 0–2 security invariant.

## 2. Canonical Failure Flow

```text
TASK → PLAN → POLICY GATE → EXECUTION → OBSERVE
                              ├→ SUCCESS → COMPLETE
                              ├→ TRANSIENT FAILURE → BOUNDED RETRY
                              ├→ TIMEOUT → CANCEL / RECOVER
                              ├→ POLICY DENIAL → BLOCK
                              ├→ CREDENTIAL FAILURE → BLOCK + REMEDIATE
                              └→ CRITICAL/UNKNOWN → SAFE STOP + INCIDENT
```

## 3. Phase 3 Components

### 3.1 Execution Safety Controller

Controls execution limits, timeout enforcement, cancellation, concurrency, and safe-stop behavior.

### 3.2 Observability Layer

Emit structured operational telemetry. Minimum context:

- correlation ID
- task ID
- run ID
- workspace ID
- capability ID
- actor
- timestamps
- duration
- status
- error class
- retry count
- policy outcome

Secrets and raw credential values must never enter logs, events, traces, or incident metadata.

### 3.3 Failure Classifier

Classify failures into controlled categories:

- `TRANSIENT`
- `VALIDATION`
- `AUTHORIZATION`
- `CREDENTIAL`
- `EXTERNAL_SERVICE`
- `TIMEOUT`
- `CANCELLED`
- `SYSTEM`
- `UNKNOWN`
- `CRITICAL`

Classification must be deterministic where possible and fail closed when uncertain.

### 3.4 Retry Controller

Retries must be bounded by explicit policy:

- maximum attempts
- backoff
- timeout
- retryable failure classes
- workspace/capability limits

No infinite retry loops. Retry must re-check authorization and approval requirements; retry is never a policy bypass.

### 3.5 Cancellation Controller

Cancellation must be explicit, auditable, and cooperative at execution-adapter boundaries. A cancelled execution must not silently transition to success.

### 3.6 Recovery Controller

Recovery must distinguish:

- not started
- started with known failure
- started with outcome unknown
- completed
- failed
- cancelled

When a side-effecting execution has an unknown outcome, recovery must stop rather than blindly repeat unless a verified idempotency strategy makes replay safe.

### 3.7 Concurrency Controller

Support bounded limits at minimum for:

- HALSTRAL core
- workspace
- capability
- task/run

When a limit is reached, new protected execution is blocked or queued according to an explicit policy. Limits cannot be bypassed by retries.

### 3.8 Incident Controller

Critical safety failures create an auditable incident record and may trigger safe-stop.

## 4. Safety Invariants

The following invariants are mandatory:

1. Default-deny authorization remains unchanged.
2. Disabled capabilities cannot be newly executed.
3. Suspended workspaces cannot execute protected actions.
4. Archived workspaces cannot receive new work.
5. Retry cannot bypass policy or approval.
6. Recovery cannot duplicate side effects without an idempotency strategy.
7. Secrets never appear in logs, events, traces, or incidents.
8. Protected state transitions are auditable.
9. Unknown outcomes are never marked successful.
10. Critical safety failures trigger safe-stop at the appropriate scope.

## 5. Timeout Model

Support explicit:

- step timeout
- task timeout
- run/execution timeout

On timeout:

1. attempt safe cancellation;
2. record the timeout event;
3. classify the failure as `TIMEOUT`;
4. retry/recover only if policy and idempotency make it safe;
5. otherwise block/escalate.

Timeout values must be bounded and validated.

## 6. Idempotency & Duplicate-Side-Effect Protection

Side-effecting executions should use an idempotency key wherever supported.

Before retry or recovery, determine whether the previous attempt may already have produced an external side effect.

If outcome is unknown and idempotency cannot establish safe replay, the system must enter a conservative blocked/manual-review path.

Completed idempotent operations must not be executed again merely because the orchestration request was replayed.

## 7. State Consistency

No impossible state transitions are allowed.

Examples:

- completed run does not return to running under ordinary operation;
- blocked task cannot execute without a new valid authorization path;
- cancelled run cannot silently become completed;
- failed step cannot be marked successful without a valid new execution/result;
- retry exhaustion produces a terminal failure state;
- safe-stop prevents protected execution within its affected scope.

## 8. Safe-Stop

Safe-stop prevents new protected execution for an affected scope while preserving inspection and audit access.

Supported scopes:

- step
- run
- task
- capability
- workspace
- HALSTRAL core

A safe-stop release requires an authorized owner/operator action and must itself be audited.

Safe-stop must not delete evidence or conceal the triggering failure.

## 9. Phase 3 Events

At minimum, integrate these with the existing append-only audit/event architecture:

- `EXECUTION_TIMEOUT`
- `EXECUTION_CANCELLED`
- `EXECUTION_RETRY_SCHEDULED`
- `EXECUTION_RETRY_EXHAUSTED`
- `RECOVERY_STARTED`
- `RECOVERY_COMPLETED`
- `RECOVERY_BLOCKED`
- `SAFE_STOP_TRIGGERED`
- `SAFE_STOP_RELEASED`
- `INCIDENT_CREATED`
- `INCIDENT_RESOLVED`
- `CONCURRENCY_LIMIT_REACHED`

Existing Phase 0–2 lifecycle events remain intact.

## 10. Incident Contract

Use an equivalent structure:

```yaml
incident:
  id
  severity
  workspace_id
  task_id
  run_id
  category
  summary
  status
  detected_at
  resolved_at
  metadata
```

Severity:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Status:

- `OPEN`
- `ACKNOWLEDGED`
- `MITIGATED`
- `RESOLVED`
- `CLOSED`

Incident metadata must be secret-safe and workspace-scoped.

## 11. Owner Controls

The owner control plane must be able to inspect, subject to authorization:

- active runs
- failed/retrying runs
- blocked and timed-out runs
- incidents
- safe-stop state
- workspace health
- capability health
- recovery state

Authorized controls must provide an auditable path to stop, disable, recover, resolve, or release affected scopes.

## 12. Recovery Rules

Recovery must be deliberate rather than autonomous improvisation.

For a retryable failure:

```text
FAILURE → CLASSIFY → POLICY CHECK → IDEMPOTENCY CHECK → RETRY (bounded)
```

For an unknown side-effect outcome:

```text
UNKNOWN → SAFE STOP → INCIDENT → INSPECT → EXPLICIT RECOVERY
```

Recovery cannot weaken authorization, approval, workspace isolation, or credential boundaries.

## 13. Non-Goals

Phase 3 does not introduce:

- unrestricted autonomy
- self-modifying code
- automatic security-policy weakening
- irreversible autonomous recovery of unknown side effects
- cross-workspace data pooling
- financial automation
- arbitrary remote code execution
- unrestricted browser automation

## 14. Acceptance Gate

Phase 3 is accepted only when evidence demonstrates:

1. structured observability;
2. bounded retry;
3. timeout handling;
4. explicit cancellation;
5. safe recovery behavior;
6. idempotency/duplicate-side-effect protection where applicable;
7. concurrency limits;
8. safe-stop controls;
9. critical incident creation;
10. complete auditability;
11. preservation of Phase 0–2 security invariants.

Required automated tests must cover both normal and adversarial paths.

## 15. Definition of Done

> HALSTRAL can fail without becoming uncontrolled: failures are classified, retries are bounded, timeouts and cancellation are explicit, unknown outcomes are handled conservatively, critical failures can trigger safe-stop, and the owner can inspect and recover through auditable controls.

Only after this gate passes should Phase 4 learning/optimization work begin.