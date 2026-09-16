# HALSTRAL — Genspark Phase 2 Master Implementation Prompt

## ROLE

You are the implementation engineer for the private HALSTRAL repository.

Repository: `Sparkmind-obp-off/Hastral`

System: **HALSTRAL — Private Business Orchestration Core**

Phase 1 has already been completed. Do not rebuild Phase 0–1 unless inspection reveals a concrete defect required for Phase 2 correctness.

Your mission is to implement **Phase 2 — Task Orchestration & Execution Coordination** according to the repository contracts.

## SOURCE OF TRUTH

Read first:

1. `README.md`
2. `docs/00_SYSTEM_CHARTER.md`
3. `docs/01_ARCHITECTURE_BLUEPRINT.md`
4. `docs/02_SECURITY_AND_OWNERSHIP.md`
5. `docs/03_ROADMAP.md`
6. `docs/04_PHASE_0_1_SPECIFICATION.md`
7. `docs/05_ACCEPTANCE_CRITERIA.md`
8. `docs/06_IMPLEMENTATION_CONTRACT.md`
9. `docs/08_PHASE_2_ORCHESTRATION_SPECIFICATION.md`

Treat the Phase 2 specification as the primary implementation contract for this phase.

## MISSION

Extend the existing HALSTRAL control plane so it can safely coordinate governed work:

```text
TASK
 ↓
CLASSIFY
 ↓
WORKSPACE SELECTION
 ↓
CAPABILITY SELECTION
 ↓
POLICY GATE
 ↓
PLAN
 ↓
DISPATCH
 ↓
RUN
 ↓
RESULT
 ↓
VALIDATE
 ↓
COMPLETE / FAIL / RETRY / BLOCK
 ↓
AUDIT
```

The system must preserve all Phase 0–1 guarantees.

## NON-NEGOTIABLE SECURITY RULES

1. Default authorization remains `DENY`.
2. No execution may bypass policy evaluation.
3. Every execution has explicit workspace context.
4. Capabilities must be registered and active.
5. Capability ownership/scope must be respected.
6. Suspended workspaces cannot execute.
7. Archived workspaces cannot receive new work.
8. Cross-workspace access requires explicit authorization.
9. Credentials must be scoped and never exposed as plaintext in logs or audit records.
10. Authorization denial must never be converted into a successful retry.
11. High-risk/critical actions require the approval behavior defined by policy.
12. Do not add arbitrary remote code execution.

## REQUIRED PHASE 2 COMPONENTS

Implement the equivalent of:

### 1. Task Classifier

Determine task classification and identify:

- workspace
- task type
- required capability/capabilities
- risk level
- constraints

### 2. Planner

Create a bounded execution plan containing:

- plan ID
- task ID
- workspace ID
- ordered steps
- capability IDs
- dependencies
- approval requirements
- timeouts
- retry policy
- expected outputs

### 3. Capability Selector

Select only capabilities that are:

- registered
- active
- compatible with the task
- authorized for the workspace/context

### 4. Policy Gate

Evaluate authorization immediately before protected execution.

The policy gate must be centralized and reusable.

### 5. Dispatcher

Dispatch approved steps to controlled execution adapters.

The dispatcher must not provide arbitrary credentials or arbitrary capabilities.

### 6. Execution Runner / Adapter Boundary

Execute a bounded capability invocation through an explicit adapter contract.

The adapter receives only:

- approved capability
- workspace context
- task/run context
- approved input
- scoped credential reference where needed
- policy context

### 7. State Manager

Maintain consistent state for task, plan, step, and run.

### 8. Retry/Recovery Controller

Support bounded retries only for explicitly retryable errors.

Controls must include:

- maximum attempts
- backoff
- step timeout
- overall task timeout
- retryable/non-retryable classification

### 9. Result Handler

Validate and store results against the correct task/run/workspace.

### 10. Observability/Audit

Record the complete orchestration lifecycle without secrets.

## REQUIRED STATE FLOW

Implement a controlled lifecycle equivalent to:

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

Invalid state transitions must be rejected.

A denied policy decision must result in a non-executing state such as `BLOCKED`.

## EXECUTION PLAN CONTRACT

Use an equivalent structure:

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

Plans must be inspectable before execution when approval is required.

## CAPABILITY INVOCATION CONTRACT

Use an equivalent structure:

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

Never put credential values into this domain object.

## APPROVAL MODEL

Preserve the existing risk model:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Approval requirements come from policy and capability risk. Do not silently weaken an approval requirement.

Critical/high-risk external actions must remain governed and explicit.

## IDEMPOTENCY

Where an action can create an external side effect, implement an idempotency boundary so retries do not unintentionally duplicate the side effect.

If an external adapter cannot safely guarantee idempotency, it must expose that limitation and default to a safer blocked/manual path where appropriate.

## FAILURE HANDLING

Classify failures.

Examples:

- transient infrastructure failure → retryable within limits
- invalid input → non-retryable
- authorization denial → non-retryable until authorization changes
- credential failure → block for remediation
- external refusal → bounded retry only if policy permits

Never create infinite retry loops.

## REQUIRED AUDIT EVENTS

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

Use the existing event/audit architecture rather than creating an unrelated logging system.

## REQUIRED TEST MATRIX

Add automated tests for at least:

### Orchestration

1. task classification
2. workspace resolution
3. capability selection
4. plan creation
5. successful dispatch
6. successful execution
7. result persistence
8. task completion

### Security

9. default-deny blocks execution
10. unauthorized capability is blocked
11. suspended workspace cannot execute
12. archived workspace cannot receive new task
13. cross-workspace access is denied without explicit authorization
14. disabled capability cannot execute
15. credentials are not leaked into logs/audit/results

### Failure/recovery

16. retryable failure retries within maximum attempts
17. non-retryable failure does not retry
18. authorization denial does not retry automatically
19. timeout transitions correctly
20. cancellation stops further execution
21. idempotency prevents unintended duplicate side effects

### Audit

22. complete lifecycle is auditable
23. denied policy decisions are auditable
24. approval events are auditable

## EXECUTION ADAPTER DESIGN

Do not couple the core orchestration engine directly to a specific external service.

Create an adapter boundary such as:

```text
HALSTRAL Core
     ↓
Capability Contract
     ↓
Execution Adapter
     ↓
External/Internal Tool
```

This allows future adapters for GitHub, web research, Make, APIs, documents, or other systems without changing the orchestration core.

For Phase 2, use mock/internal adapters for tests where real external integrations would introduce unnecessary credentials or side effects.

## SCOPE CONTROL

Do NOT expand this phase into:

- unrestricted autonomous agents
- autonomous financial transactions
- unrestricted browser automation
- global credential access
- automatic cross-business data pooling
- arbitrary code execution
- unsupervised high-risk communication
- billing/subscription infrastructure
- speculative Phase 3 learning/optimization systems

Implement only what is required to make the orchestration contract real and testable.

## IMPLEMENTATION SEQUENCE

### Step 1 — Inspect

Inspect the existing Phase 1 implementation and tests before modifying anything.

### Step 2 — Preserve

Confirm existing workspace, capability, policy, task, run, and audit contracts still pass.

### Step 3 — Domain

Add orchestration entities/services: plan, step, invocation, execution state, retry policy, and result handling as required.

### Step 4 — Policy gate

Integrate centralized authorization into execution.

### Step 5 — Planner/classifier

Implement task classification and bounded plan generation.

### Step 6 — Dispatcher/adapter

Implement controlled capability dispatch and an adapter interface.

### Step 7 — Runner

Implement bounded execution state transitions and result handling.

### Step 8 — Recovery

Implement bounded retry, timeout, cancellation, and failure classification.

### Step 9 — Audit/observability

Integrate lifecycle events into the existing audit system.

### Step 10 — Tests

Run Phase 1 regression tests plus the complete Phase 2 test matrix.

### Step 11 — Documentation

Document the selected architecture, execution adapter contract, state machine, environment requirements, setup, and tests.

### Step 12 — Final verification

Do not claim Phase 2 PASS until all mandatory tests and acceptance criteria pass.

## REQUIRED FINAL REPORT

Return a concise implementation report containing:

- selected stack
- architecture changes
- files changed
- new domain components
- API changes
- migration changes
- adapter contract
- security behavior
- test command
- test result
- Phase 1 regression result
- Phase 2 acceptance result
- known limitations
- final commit SHA

If any required criterion fails, report `PHASE 2 NOT READY` and identify the failing criteria.

## DEFINITION OF DONE

HALSTRAL Phase 2 is complete when a governed task can move from intake through classification, planning, policy authorization, controlled dispatch, bounded execution, result handling, and final state — with retries/recovery where appropriate and complete auditability — while preserving strict business workspace isolation.

Only after this gate passes may Phase 3 be designed/implemented.
