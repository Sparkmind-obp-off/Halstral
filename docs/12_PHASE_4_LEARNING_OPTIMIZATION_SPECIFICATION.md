# HALSTRAL — Phase 4 Learning & Optimization Specification

## 1. Purpose

Phase 3 made execution observable, bounded, recoverable, and safe. Phase 4 turns verified operational outcomes into controlled learning and optimization without allowing the system to silently rewrite its own rules.

Canonical objective:

> Learn from verified outcomes, optimize deliberately, preserve control.

Phase 4 introduces outcome capture, learning signals, workflow optimization, reusable capability promotion, and performance measurement while preserving all Phase 0–3 security and safety invariants.

## 2. Canonical Learning Flow

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

Learning is evidence-driven. An observation is not automatically a trusted learning signal, and a learning signal is not automatically a production change.

## 3. Phase 4 Components

### 3.1 Outcome Capture

Capture structured results from completed, failed, cancelled, blocked, and recovered executions.

Minimum useful context:
- workspace ID
- task/run ID
- capability/workflow ID
- outcome status
- timestamps and duration
- attempts/retries
- policy outcome
- error class when applicable
- measurable result metrics
- provenance/reference to source execution

Secrets and raw credentials must never be captured as learning data.

### 3.2 Learning Signal Engine

Convert verified outcomes into explicit signals such as:
- success/failure rate
- latency/duration
- retry frequency
- timeout frequency
- recovery frequency
- policy-denial frequency
- quality/result metrics where available
- cost/resource metrics where available

Signals must retain provenance and confidence/validation state where applicable.

### 3.3 Workflow Optimization Engine

Identify optimization candidates from accumulated evidence, for example:
- ordering of compatible steps
- timeout/backoff tuning within policy bounds
- routing to an existing capability
- removal of consistently unnecessary steps
- reuse of a previously successful workflow pattern

Optimization proposals must remain bounded by existing contracts and policies.

### 3.4 Improvement Proposal Model

Every proposed change must be explicit and traceable.

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

Suggested statuses:
`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `APPLIED`, `REJECTED`, `REVERTED`, `DISABLED`.

### 3.5 Reusable Capability Promotion

A capability/workflow pattern may be promoted for reuse only when its provenance, ownership, scope, security contract, and performance evidence are known.

Promotion must not merge workspace-private data or credentials into another workspace.

A promoted capability remains subject to registration, policy, authorization, approval, and Phase 3 safety controls.

### 3.6 Performance Measurement

Measure before/after behavior for applied improvements where meaningful.

At minimum support comparison of:
- success rate
- latency
- retry rate
- timeout rate
- recovery rate
- resource/cost metric when available

Measurements must be scoped and attributable to the relevant workflow/capability/version.

## 4. Learning Safety Invariants

1. Learning never weakens authorization.
2. Learning never bypasses approval requirements.
3. Learning cannot cross workspace boundaries without an explicit authorized contract.
4. Observations do not become policy automatically.
5. Production configuration changes require an explicit controlled application path.
6. Every applied learning change is auditable.
7. Every applied learning change is reversible or explicitly documented as non-reversible before approval.
8. Failed experiments cannot silently become active configuration.
9. Secrets and sensitive credentials never enter learning records.
10. Existing safe-stop, incident, timeout, cancellation, retry, and idempotency controls remain authoritative.
11. A low-quality or unverified outcome cannot be promoted as trusted evidence.
12. The system cannot self-modify its security boundary.

## 5. Evidence & Provenance

Learning records must reference the executions and observations from which they were derived. Evidence should be immutable or append-only where practical.

A learning record should distinguish:
- observed fact
- derived metric
- interpretation/hypothesis
- proposed change
- approved change
- measured post-change result

Do not collapse these into a single unqualified "AI learned" state.

## 6. Experiments & Rollback

Optimization should support controlled experiments where technically appropriate.

Experiment requirements:
- explicit target
- bounded duration or sample size
- known baseline
- measurable success criteria
- authorized scope
- audit trail
- rollback/revert path

If an applied change degrades agreed metrics or violates a safety invariant, it must be eligible for controlled rollback/disablement.

## 7. Versioning

Optimized workflows, capability configurations, and reusable patterns should have identifiable versions or revisions.

A result must be attributable to the version/configuration that produced it. Historical evidence must remain inspectable after a new version is applied.

## 8. Workspace Isolation

Default behavior remains workspace-local.

Cross-workspace reuse requires an explicit capability/data-sharing contract that defines:
- owner
- allowed data
- allowed operations
- destination workspace
- policy requirements
- audit requirements

No implicit portfolio-wide learning dataset may be created from private workspace data.

## 9. Owner Controls

The owner control plane should be able to inspect:
- outcome records
- learning signals
- optimization proposals
- proposal evidence
- active/reverted revisions
- performance comparisons
- capability promotion state
- rejected/disabled proposals

The owner should be able to approve, reject, apply, revert, or disable proposals only through authorized and auditable paths.

## 10. Phase 4 Events

Integrate with the existing append-only event architecture. At minimum:

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

Existing Phase 0–3 events remain intact.

## 11. Non-Goals

Phase 4 does not introduce:
- unrestricted self-improvement
- autonomous security-policy changes
- autonomous credential acquisition
- unrestricted cross-workspace data pooling
- self-modifying infrastructure
- arbitrary code generation/execution as a learning mechanism
- automatic financial decisions
- silent production changes

## 12. Acceptance Gate

Phase 4 is accepted only when evidence demonstrates:

1. verified outcome capture;
2. traceable learning signals;
3. explicit optimization proposals;
4. policy/owner review before protected changes;
5. measurable before/after performance;
6. versioned applied changes;
7. reversible/disableable optimization where applicable;
8. reusable capability promotion with ownership and security checks;
9. workspace isolation;
10. complete auditability;
11. preservation of Phase 0–3 invariants.

## 13. Definition of Done

> HALSTRAL can learn from verified outcomes without losing control: evidence is captured with provenance, improvements are proposed explicitly, changes are reviewed and auditable, performance is measured, reusable capabilities are promoted deliberately, and optimization remains reversible and bounded by the existing security and safety model.

Only after this gate passes should Phase 5 portfolio-scale capabilities be introduced.
