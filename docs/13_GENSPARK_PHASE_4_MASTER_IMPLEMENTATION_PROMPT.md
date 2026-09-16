# HALSTRAL — Genspark Phase 4 Master Implementation Prompt

## ROLE

You are the implementation engineer for the private HALSTRAL repository.

Repository: `Sparkmind-obp-off/Halstral`
System: **HALSTRAL — Private Business Orchestration Core**

Phase 0, Phase 1, Phase 2, and Phase 3 are already established. Implement **Phase 4 — Learning & Optimization** without rebuilding completed phases except where a concrete defect is required for Phase 4 correctness.

## MISSION

Implement controlled learning from verified outcomes:

```text
EXECUTION → OBSERVE → OUTCOME CAPTURE → VALIDATE SIGNAL
                                      ↓
                              LEARNING RECORD
                                      ↓
                              PROPOSE IMPROVEMENT
                                      ↓
                              POLICY / OWNER REVIEW
                                      ↓
                         CONTROLLED APPLICATION
                                      ↓
                              MEASURE → COMPARE
                                      ↓
                         KEEP / REVERT / DISABLE
```

Core principle:

> Learn from verified outcomes, optimize deliberately, preserve control.

## SOURCE OF TRUTH

Read these repository documents before changing code:

- `README.md`
- `docs/00_SYSTEM_CHARTER.md`
- `docs/01_ARCHITECTURE_BLUEPRINT.md`
- `docs/02_SECURITY_AND_OWNERSHIP.md`
- `docs/03_ROADMAP.md`
- `docs/04_PHASE_0_1_SPECIFICATION.md`
- `docs/05_ACCEPTANCE_CRITERIA.md`
- `docs/06_IMPLEMENTATION_CONTRACT.md`
- `docs/08_PHASE_2_ORCHESTRATION_SPECIFICATION.md`
- `docs/09_GENSPARK_PHASE_2_MASTER_IMPLEMENTATION_PROMPT.md`
- `docs/10_PHASE_2_IMPLEMENTATION_GUIDE.md`
- `docs/11_PHASE_2_ACCEPTANCE_EVIDENCE.md`
- `docs/10_PHASE_3_SAFETY_OBSERVABILITY_RECOVERY_SPECIFICATION.md`
- `docs/03_ROADMAP.md`
- this Phase 4 specification

The Phase 4 specification is authoritative for Phase 4 scope. Existing Phase 0–3 contracts remain authoritative for security, authorization, execution, recovery, and workspace boundaries.

## NON-NEGOTIABLE RULES

1. Preserve default-deny authorization.
2. Learning must never weaken policy or approval requirements.
3. Learning must never bypass Phase 3 safety controls.
4. Workspace isolation remains mandatory by default.
5. Observations do not automatically become trusted learning.
6. No silent production configuration changes.
7. Every applied improvement is auditable.
8. Applied improvements must be reversible or explicitly documented as non-reversible before approval.
9. Failed/unverified experiments cannot silently become active configuration.
10. Secrets and raw credentials must never enter outcome, learning, proposal, telemetry, or audit data.
11. Security boundaries cannot be self-modified by the learning system.
12. Unknown or low-confidence outcomes must not be promoted as trusted evidence.
13. Cross-workspace reuse requires an explicit authorized contract.
14. Existing safe-stop, incident, timeout, cancellation, retry, and idempotency controls remain authoritative.
15. Do not introduce unrestricted autonomy, arbitrary RCE, unrestricted browser automation, financial automation, or autonomous credential acquisition.

## FIRST ACTION: INSPECT BEFORE IMPLEMENTING

1. Inspect the current Phase 2 and Phase 3 implementation.
2. Identify existing task/run/result/audit/capability/policy/workspace models.
3. Identify existing migrations and test conventions.
4. Run the existing Phase 0–3 test suite before modification.
5. Do not duplicate existing domain concepts when they can be extended safely.
6. Keep implementation consistent with the existing TypeScript/Hono/Cloudflare D1/Vite/Vitest stack unless a documented technical reason requires otherwise.

## REQUIRED PHASE 4 COMPONENTS

### 1. Outcome Capture

Capture structured outcomes from executions, including success, failure, cancellation, blocked, and recovered outcomes where meaningful.

Minimum context:
- workspace ID
- task/run ID
- capability/workflow ID
- outcome status
- timestamps and duration
- attempts/retries
- policy outcome
- error class where applicable
- measurable result metrics where available
- provenance/reference to source execution

Outcome records must remain workspace-scoped and secret-safe.

### 2. Learning Signal Engine

Derive explicit signals from verified outcome data, including where applicable:
- success/failure rate
- latency/duration
- retry frequency
- timeout frequency
- recovery frequency
- policy-denial frequency
- quality/result metrics
- cost/resource metrics

Retain provenance. Where confidence or validation status matters, store it explicitly.

Do not represent an unverified inference as an observed fact.

### 3. Optimization Proposal Engine

Create explicit improvement proposals from evidence.

Equivalent contract:

```yaml
proposal:
  id
  workspace_id
  target_type
  target_id
  reason
  evidence_refs
  current_config
  proposed_config
  expected_effect
  risk_class
  status
  created_at
  reviewed_at
  applied_at
  reverted_at
```

Supported lifecycle should include:
`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `APPLIED`, `REJECTED`, `REVERTED`, `DISABLED`.

### 4. Controlled Optimization Application

An approved proposal may be applied only through an explicit controlled path.

Before application:
- verify workspace state
- verify target exists
- verify capability/configuration is still current
- re-evaluate relevant authorization/policy
- enforce required approval
- record audit event
- preserve prior configuration/version for rollback

Never let a model or heuristic directly mutate protected configuration outside the governed application path.

### 5. Performance Measurement

Measure before/after behavior for applied improvements.

Support comparisons for:
- success rate
- latency
- retry rate
- timeout rate
- recovery rate
- cost/resource metrics where available

Attribute measurements to workflow/capability/version so historical results remain interpretable.

### 6. Versioning

Optimized workflows, capability configurations, and reusable patterns need identifiable versions/revisions.

A result must be attributable to the version/configuration that produced it.

Historical evidence must remain inspectable after a new version is applied.

### 7. Reusable Capability Promotion

Allow a capability/workflow pattern to be proposed for reuse only when:
- provenance is known
- ownership is known
- security contract is known
- scope is known
- performance evidence exists

Promotion must remain subject to registration, policy, authorization, approval, and Phase 3 safety controls.

Do not copy private workspace data or credentials into another workspace.

## EVIDENCE MODEL

Keep these concepts distinct:

```text
OBSERVED FACT
     ↓
DERIVED METRIC
     ↓
INTERPRETATION / HYPOTHESIS
     ↓
PROPOSED CHANGE
     ↓
APPROVED CHANGE
     ↓
POST-CHANGE MEASUREMENT
```

Do not collapse them into an unqualified `AI_LEARNED` state.

Learning records must reference the executions/observations from which they were derived.

## EXPERIMENTS

If controlled experiments are implemented, every experiment must have:
- explicit target
- bounded duration or sample size
- known baseline
- measurable success criteria
- authorized scope
- audit trail
- rollback/revert path

An experiment that performs worse must be eligible for controlled rollback or disablement.

## WORKSPACE ISOLATION

Default learning is workspace-local.

Cross-workspace reuse requires an explicit contract defining at minimum:
- owner
- allowed data
- allowed operations
- destination workspace
- policy requirements
- audit requirements

Do not create an implicit portfolio-wide learning dataset from private business data.

## OWNER CONTROL PLANE

Provide appropriate authorized inspection/control paths for:
- outcome records
- learning signals
- optimization proposals
- evidence references
- active/reverted revisions
- performance comparisons
- capability promotion state
- rejected/disabled proposals

Authorized actions should include, where appropriate:
- approve
- reject
- apply
- revert
- disable
- promote

Every protected action must be auditable.

Do not invent a large UI surface if the existing architecture does not need one. Prefer a minimal API/domain implementation that satisfies the contract.

## REQUIRED EVENTS

Integrate with the existing append-only event/audit architecture:

- `OUTCOME_CAPTURED`
- `LEARNING_SIGNAL_CREATED`
- `OPTIMIZATION_PROPOSED`
- `OPTIMIZATION_APPROVED`
- `OPTIMIZATION_APPLIED`
- `OPTIMIZATION_REVERTED`
- `OPTIMIZATION_REJECTED`
- `CAPABILITY_PROMOTION_PROPOSED`
- `CAPABILITY_PROMOTED`
- `CAPABILITY_PROMOTION_REJECTED`
- `PERFORMANCE_MEASURED`

Do not remove or rename existing Phase 0–3 lifecycle events.

## DATA / MIGRATION REQUIREMENTS

Add only the schema required for Phase 4.

Potential domains include:
- outcome records
- learning signals
- optimization proposals
- configuration/workflow revisions
- performance measurements
- capability promotion records

Requirements:
- workspace scoping
- provenance references
- status constraints
- timestamps
- indexes for common inspection queries
- safe migration from existing data
- no destructive migration without explicit necessity

Do not store secrets or raw credential values in these tables.

## API REQUIREMENTS

Use the existing API conventions. Add only the minimal protected endpoints needed for Phase 4, such as routes for:
- outcome inspection
- learning signal inspection
- proposal creation/inspection
- proposal approval/rejection
- controlled application
- revert/disable
- performance comparison
- capability promotion workflow

Exact route design is implementation-defined, but every protected mutation must pass through authorization/policy and audit boundaries.

## TEST REQUIREMENTS

### Outcome capture
- successful outcome captured
- failed outcome captured
- cancelled/blocked outcome represented correctly
- provenance preserved
- workspace isolation
- secret redaction

### Learning signals
- valid signal generated from verified evidence
- derived metrics trace to source outcomes
- unverified evidence is not treated as trusted
- workspace boundaries enforced

### Optimization proposals
- proposal contains evidence references
- proposal lifecycle enforced
- invalid transitions rejected
- proposal does not directly mutate production state

### Approval/application
- unapproved proposal cannot apply
- authorization is rechecked at application time
- policy denial blocks application
- applied change creates audit event
- prior revision remains recoverable

### Measurement
- baseline captured
- post-change measurement captured
- version attribution preserved
- before/after comparison is deterministic

### Rollback
- applied change can be reverted where applicable
- revert is authorized and audited
- reverted configuration becomes identifiable
- failed experiment cannot remain silently active

### Capability promotion
- promotion requires ownership/provenance/security evidence
- promotion is not an implicit cross-workspace data transfer
- promoted capability remains governed by existing registries/policies/safety controls

### Security regression
- default-deny preserved
- disabled capability blocked
- suspended workspace blocked
- archived workspace blocked
- cross-workspace access denied by default
- secrets absent from learning/observability/audit payloads
- Phase 3 safe-stop still blocks protected execution

### Regression
- all existing Phase 0–3 tests pass
- no existing contract silently changes

## IMPLEMENTATION QUALITY RULES

- Prefer explicit domain services over scattered business logic.
- Keep authorization centralized.
- Keep workspace scoping explicit in queries and mutations.
- Use typed status/state transitions.
- Preserve append-only evidence where appropriate.
- Make optimization deterministic and testable.
- Avoid premature ML infrastructure; Phase 4 can use deterministic metrics and rule-based proposals first.
- Do not add external AI providers or external credentials merely to demonstrate learning.
- Use deterministic internal/mock data in tests.
- Keep production side effects behind the existing governed execution boundary.

## SCOPE CONTROL

Do NOT implement:
- unrestricted self-improvement
- self-modifying security rules
- autonomous credential acquisition
- implicit cross-workspace training/data pooling
- arbitrary code generation/execution as a learning mechanism
- autonomous financial decisions
- silent production changes
- a generalized AGI/agent framework

If a requested feature conflicts with these constraints, preserve the Phase 4 contract instead.

## IMPLEMENTATION SEQUENCE

1. Inspect Phase 0–3 architecture.
2. Run the current tests and record baseline.
3. Design Phase 4 domain contracts.
4. Add minimal migrations.
5. Implement outcome capture.
6. Implement learning signal derivation.
7. Implement proposal lifecycle.
8. Implement controlled approval/application.
9. Implement versioning and rollback/disablement.
10. Implement performance measurement.
11. Implement capability promotion flow if supported by the existing registry model.
12. Integrate audit/events.
13. Add protected API paths as needed.
14. Add comprehensive tests.
15. Run the full Phase 0–4 test suite.
16. Produce acceptance evidence and implementation documentation.

## DEFINITION OF DONE

Phase 4 is ready only when:

- verified outcomes are captured;
- learning signals are traceable to evidence;
- improvements are explicit proposals;
- protected changes require policy/owner review;
- applied changes are versioned and auditable;
- performance is measured before/after where applicable;
- optimization is reversible/disableable where applicable;
- reusable capabilities have ownership/security/provenance checks;
- workspace isolation remains intact;
- Phase 0–3 invariants remain intact;
- all tests pass.

## FINAL REPORT REQUIRED FROM GENSPARK

Return a concise implementation report containing:

1. stack used;
2. architecture changes;
3. files created/modified;
4. database migrations;
5. API endpoints added/changed;
6. outcome/learning model;
7. proposal and approval model;
8. versioning/rollback model;
9. performance measurement model;
10. capability promotion model;
11. security and workspace-isolation checks;
12. test counts and results;
13. Phase 0–3 regression result;
14. Phase 4 acceptance evidence;
15. known limitations;
16. final commit SHA.

If any mandatory acceptance item fails, explicitly report:

`PHASE 4 NOT READY`

Do not claim completion merely because the code compiles.
