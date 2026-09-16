# HALSTRAL Phase 2 — Task Orchestration & Execution Coordination

## 1. Purpose

Phase 2 moves HALSTRAL from a registry/control plane into an orchestration layer.

Phase 1 established that HALSTRAL can represent workspaces, capabilities, policies, tasks, runs, and audit events.

Phase 2 establishes that HALSTRAL can coordinate a task through a governed execution lifecycle while preserving the security boundaries established in Phase 0–1.

## 2. Canonical Role

> HALSTRAL coordinates businesses; it does not become the business.

HALSTRAL remains a private orchestration core for multiple independent business workspaces.

## 3. Core Flow

```text
OWNER / REQUEST
      ↓
TASK INTAKE
      ↓
CLASSIFY
      ↓
SELECT WORKSPACE
      ↓
SELECT CAPABILITY
      ↓
POLICY GATE
      ↓
CREATE EXECUTION PLAN
      ↓
DISPATCH
      ↓
EXECUTE
      ↓
COLLECT RESULT
      ↓
VALIDATE RESULT
      ↓
COMPLETE / FAIL / RETRY / BLOCK
      ↓
AUDIT + OBSERVABILITY
```

## 4. Phase 2 Components

### 4.1 Task Classifier

Determines task type, required workspace, required capability, risk level, and execution constraints.

It must not bypass authorization.

### 4.2 Planner

Transforms an accepted task into a bounded execution plan.

A plan should contain:

- task ID
- workspace ID
- ordered steps
- required capabilities
- policy requirements
- dependencies
- timeout/retry constraints
- expected outputs

### 4.3 Capability Selector

Matches task requirements to registered capabilities.

Only active and authorized capabilities may be selected for execution.

### 4.4 Policy Gate

Re-evaluates authorization immediately before protected execution.

Policy evaluation must remain default-deny.

### 4.5 Dispatcher

Sends approved execution steps to the appropriate internal execution adapter/runner.

The dispatcher must not directly expose arbitrary credentials or bypass capability contracts.

### 4.6 Execution Runner

Executes a bounded capability invocation.

The runner must receive only the inputs and credentials required for the approved capability.

### 4.7 State Manager

Tracks task, plan, step, and run state consistently.

### 4.8 Retry and Recovery Controller

Handles explicitly retryable failures using bounded retry policies.

Retry must not turn a denied action into an allowed action.

### 4.9 Result Handler

Validates, stores, and associates execution results with the correct task/run/workspace.

### 4.10 Observability Layer

Records lifecycle events, execution timing, outcomes, failures, and policy decisions without exposing secrets.

## 5. Workspace Isolation

Every orchestration run must have an explicit workspace context.

Rules:

- A task belongs to one workspace unless an explicit multi-workspace policy exists.
- Capability selection must respect workspace ownership/scope.
- Credentials are scoped to the approved capability/workspace.
- Results must not leak into another workspace.
- Cross-workspace orchestration requires explicit authorization and audit evidence.

## 6. Execution State Model

Recommended task states:

```text
PENDING
  ↓
CLASSIFIED
  ↓
PLANNED
  ↓
AUTHORIZED
  ↓
DISPATCHED
  ↓
RUNNING
  ├── COMPLETED
  ├── FAILED
  ├── RETRYING
  ├── BLOCKED
  └── CANCELLED
```

A denied policy check results in `BLOCKED` or an equivalent non-executing state.

## 7. Execution Plan Contract

```yaml
execution_plan:
  id
  task_id
  workspace_id
  steps:
    - id
      capability_id
      input_ref
      depends_on
      approval_required
      timeout_seconds
      retry_policy
  status
  created_at
```

The plan must be inspectable before execution where approval is required.

## 8. Capability Invocation Contract

Conceptually:

```yaml
invocation:
  capability_id
  workspace_id
  task_id
  run_id
  input
  credential_ref
  policy_context
```

The execution adapter must not receive credentials outside the approved scope.

## 9. Approval Model

Phase 2 retains the Phase 1 risk model.

- LOW: may proceed automatically when explicitly allowed.
- MEDIUM: may require owner/configured approval depending on policy.
- HIGH: requires explicit approval unless a documented policy grants otherwise.
- CRITICAL: requires explicit approval and must not be silently automated.

A policy can restrict or require approval regardless of capability risk level.

## 10. Failure and Retry

Failures must be classified.

Examples:

- transient infrastructure failure → potentially retryable
- invalid input → non-retryable until input changes
- authorization denial → non-retryable without policy/approval change
- credential failure → block and request credential remediation
- external service refusal → bounded retry only when policy allows

Never retry indefinitely.

Recommended controls:

- maximum attempts
- exponential/backoff delay
- per-step timeout
- overall task timeout
- retryable error classification

## 11. Idempotency

Protected execution should support an idempotency key where duplicate execution could cause side effects.

A retry must not unintentionally create duplicate external side effects.

## 12. Audit Requirements

At minimum, record:

- task accepted
- task classified
- plan created
- capability selected
- policy evaluated
- approval requested/granted/denied
- dispatch started
- execution started
- execution completed
- execution failed
- retry scheduled
- result stored
- task completed/cancelled/blocked

Audit metadata must never contain secret values.

## 13. Phase 2 Non-Goals

Do not automatically expand Phase 2 into:

- unrestricted autonomous agents
- unrestricted browser automation
- autonomous financial transactions
- global credential access
- cross-workspace data pooling
- arbitrary remote code execution
- unsupervised high-risk external communication

Those require separate capability, policy, security, and acceptance design.

## 14. Phase 2 Gate

Phase 2 is complete only when HALSTRAL can accept a governed task, classify it, produce a bounded plan, select an authorized capability, pass a policy gate, dispatch execution through a controlled adapter, capture the result, handle bounded failures, and record the complete lifecycle — while maintaining workspace isolation.
