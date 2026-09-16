# HALSTRAL — Genspark Phase 5 Master Implementation Prompt

## Mission

You are the implementation agent for **HALSTRAL**, repository `Sparkmind-obp-off/Halstral`.

Implement **Phase 5 — Portfolio Scale** from the repository specification:

`docs/14_PHASE_5_PORTFOLIO_SCALE_SPECIFICATION.md`

This is a controlled production-oriented implementation task. Do not redesign HALSTRAL from scratch. Extend the existing Phase 0–4 system while preserving every established contract and safety invariant.

Canonical identity:

> HALSTRAL = Private Business Orchestration Core

Canonical principle:

> One Owner → One Orchestration Core → Many Independent Businesses → Separate Workspaces

Canonical boundary:

> HALSTRAL coordinates businesses; it does not become the business.

Security principle:

> Isolate by default. Delegate explicitly. Share minimally. Audit continuously.

Core loop:

> Coordinate → Delegate → Execute → Observe → Learn → Improve

---

# 1. FIRST: INSPECT BEFORE IMPLEMENTING

Before changing code:

1. Inspect the repository tree.
2. Read:
   - `README.md`
   - `docs/00_SYSTEM_CHARTER.md`
   - `docs/01_ARCHITECTURE_BLUEPRINT.md`
   - `docs/02_SECURITY_AND_OWNERSHIP.md`
   - `docs/03_ROADMAP.md`
   - `docs/04_PHASE_0_1_SPECIFICATION.md`
   - `docs/05_ACCEPTANCE_CRITERIA.md`
   - `docs/06_IMPLEMENTATION_CONTRACT.md`
   - `docs/08_PHASE_2_ORCHESTRATION_SPECIFICATION.md`
   - `docs/10_PHASE_2_IMPLEMENTATION_GUIDE.md` if present
   - `docs/10_PHASE_3_SAFETY_OBSERVABILITY_RECOVERY_SPECIFICATION.md`
   - `docs/12_PHASE_4_LEARNING_OPTIMIZATION_SPECIFICATION.md`
   - the Phase 4 acceptance evidence document if present
   - `docs/14_PHASE_5_PORTFOLIO_SCALE_SPECIFICATION.md`
3. Inspect the existing schema/migrations.
4. Inspect existing workspace, capability, task, run, policy, audit, safety, incident, learning, optimization, and API implementations.
5. Inspect all existing tests.
6. Run the existing baseline test/typecheck/build/migration/security commands before implementation.
7. Identify the exact existing conventions for routes, validation, errors, authorization, events, persistence, and tests.

Do not assume filenames, table names, route names, or framework structure. Use the repository as the source of truth.

If an existing domain concept already represents a requirement, extend it instead of creating a duplicate.

---

# 2. PHASE BOUNDARY

Implement only **Phase 5 — Portfolio Scale**.

Do NOT:

- rewrite Phase 0–4;
- replace existing architecture without evidence;
- weaken security or safety controls;
- introduce public SaaS/multi-tenancy;
- introduce unrestricted autonomy;
- introduce autonomous financial actions;
- introduce a global credential vault;
- introduce arbitrary RCE;
- introduce unrestricted browser automation;
- introduce self-modifying security or policy boundaries;
- silently create a cross-business data pool;
- automatically copy private workspace data or credentials;
- automatically merge independent businesses into one workspace;
- add distributed infrastructure merely for appearance of scale.

Merovia remains an independent business/workspace. Do not turn Merovia into HALSTRAL or merge its workspace boundary.

---

# 3. REQUIRED PHASE 5 CAPABILITIES

Implement the minimum coherent system required for these capabilities:

## A. Portfolio/workspace inventory

The owner must be able to inspect multiple independent workspaces through a portfolio-level control path.

Prefer the existing `workspaces` entity as the authoritative business execution boundary.

Only add a separate portfolio/business metadata entity if repository evidence shows the existing model cannot safely support the requirement.

Do not duplicate workspace identity.

## B. Repeatable workspace provisioning

Provide a governed path for registering/provisioning a new workspace.

Requirements:

- stable identity;
- least-privilege defaults;
- safe default policy state;
- no implicit credential transfer;
- no implicit data transfer;
- audit event;
- idempotency where practical;
- clear failure state.

## C. Workspace lifecycle at portfolio scale

Preserve existing active/suspended/archived semantics.

Required behavior:

- suspended workspace cannot receive executable work;
- archived workspace cannot receive executable work;
- reactivation is authorized and audited;
- historical audit/evidence remains inspectable;
- lifecycle mutation re-checks current state at application time.

## D. Explicit task routing

Introduce a governed routing/delegation path if one does not already exist.

Rules:

- every executable task has explicit workspace context;
- missing/invalid workspace context is denied;
- routing recommendation is not authorization;
- routing cannot bypass workspace policy;
- routing cannot bypass approval requirements;
- a task cannot silently execute in multiple workspaces;
- suspended/archived destinations are denied;
- routing decision is auditable.

Reuse Phase 2–3 execution controls after routing. Do not build a second execution engine.

## E. Cross-workspace sharing contracts

Implement explicit, default-deny sharing governance.

Minimum contract semantics:

- source workspace;
- destination workspace;
- owner;
- allowed data;
- allowed operations;
- capability scope;
- policy requirements;
- approval requirements;
- effective period/expiry;
- version;
- status;
- audit references/provenance.

Suggested lifecycle:

`DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → REVOKED/EXPIRED`

Also support rejected/disabled states where consistent with existing conventions.

No contract means no cross-workspace sharing.

Never transfer credentials or secrets through a generic sharing contract.

Revoked/expired contracts must fail closed.

## F. Governed capability reuse

Extend Phase 4 capability promotion so a promoted capability can be explicitly authorized for another workspace without copying source-private state.

The target workspace must independently authorize/register the capability.

Reuse must validate:

- provenance;
- ownership;
- target scope;
- compatibility;
- security contract;
- policy;
- performance evidence;
- approval requirements.

No automatic credential inheritance.

No automatic private-data inheritance.

## G. Portfolio-level observability

Provide owner-authorized aggregate views for safe portfolio metadata and derived metrics.

Examples:

- workspace state;
- execution counts;
- success/failure rates;
- latency summaries;
- retries/timeouts/recovery;
- incident summaries;
- capability health;
- resource utilization;
- learning/optimization activity;
- governance events.

Do not expose raw workspace-private records merely because they are included in a portfolio view.

Preserve workspace IDs, provenance, and configuration/version attribution.

## H. Resource/concurrency governance

Introduce bounded shared-resource policies only where needed by the existing architecture.

At minimum consider:

- per-workspace concurrent run limit;
- portfolio-wide concurrent run limit;
- queue/task bounds;
- capability invocation bounds;
- bounded retry budget.

A limit breach must produce a deterministic throttle/deny outcome and audit event. It must never become false success.

Do not add billing or financial automation.

## I. Owner control plane

Provide authenticated, auditable control paths for:

- workspace inventory;
- lifecycle;
- portfolio health;
- routing decisions;
- sharing contracts;
- reusable capability governance;
- resource policies;
- portfolio incidents/safe-stop state;
- governance history.

Protected mutations must re-check authorization and current state at application time.

---

# 4. SECURITY REQUIREMENTS — NON-NEGOTIABLE

All of the following remain authoritative:

1. default deny;
2. explicit workspace context;
3. least privilege;
4. workspace isolation;
5. owner authorization;
6. capability authorization;
7. approval gates;
8. auditability;
9. secret non-disclosure;
10. Phase 3 safe-stop;
11. incident handling;
12. timeout/cancellation/retry/idempotency controls;
13. Phase 4 evidence/provenance;
14. versioned configuration;
15. reversible/disableable optimization.

Additional Phase 5 rules:

- missing workspace context → deny for workspace-scoped operation;
- invalid workspace context → deny;
- cross-workspace access without active explicit contract → deny;
- revoked/expired contract → deny;
- source credentials must never become destination credentials;
- private workspace data must never appear in portfolio aggregates unless explicitly permitted and appropriately derived;
- portfolio-level authority must not become an implicit super-capability for arbitrary workspace execution;
- learning must not silently cross workspace boundaries;
- security policy cannot be weakened by Phase 4 optimization.

Apply defense in depth. Do not rely on one middleware or one route check.

---

# 5. DATA MODEL RULES

Before creating any migration:

1. inspect current tables and relations;
2. reuse existing workspace identity;
3. add only the minimum new persistence concepts;
4. preserve backward compatibility;
5. add indexes for actual bounded access patterns;
6. make lifecycle/version/status fields explicit where relevant;
7. include ownership/scope/provenance where needed;
8. ensure protected transitions are auditable;
9. make migrations deterministic and safe.

Likely concepts may include:

- sharing contracts;
- routing records;
- portfolio resource policies;
- derived portfolio metric snapshots if persistence is actually justified.

Do not create duplicate business/workspace tables without strong evidence.

---

# 6. API RULES

Reuse existing API conventions.

Potential endpoint categories include:

```text
GET    /portfolio
GET    /portfolio/workspaces
GET    /portfolio/overview
POST   /portfolio/workspaces
POST   /routing/decisions
GET    /routing/decisions
GET    /sharing-contracts
POST   /sharing-contracts
POST   /sharing-contracts/:id/submit
POST   /sharing-contracts/:id/decision
POST   /sharing-contracts/:id/revoke
GET    /portfolio/resource-policies
POST   /portfolio/resource-policies
GET    /portfolio/metrics
```

These names are candidates only. Match the repository's actual conventions.

All list/report endpoints must be bounded and paginated where appropriate.

All mutations must validate input, authenticate, authorize, enforce scope, re-check current state, and emit audit events.

Do not expose secrets or sensitive credentials in API responses.

---

# 7. EVENT/AUDIT REQUIREMENTS

Integrate with the existing append-only event model.

Add only events needed by the implementation, using repository naming conventions.

Expected semantic coverage:

- business/workspace registration;
- lifecycle changes;
- routing and route denial;
- sharing proposal/approval/activation/revocation/expiry/rejection;
- capability reuse governance;
- resource limit changes and limit breaches;
- portfolio health measurement;
- portfolio policy denial.

Do not remove or rename Phase 0–4 events.

Audit payloads must be recursively checked for secrets/sensitive credential material according to existing Phase 4 behavior.

---

# 8. FAILURE & RECOVERY

Portfolio scale must integrate with Phase 3 failure classification and recovery.

Required behavior examples:

### Invalid routing

Deny → classify appropriately → audit → no execution outside authorized workspace.

### Invalid/expired sharing contract

Deny → audit → no unrestricted fallback.

### Resource exhaustion

Throttle/queue/deny according to policy → audit → no false success.

### Workspace suspended during protected flow

Fail closed at the next protected boundary → use existing cancellation/safe-stop/recovery behavior → audit.

### Critical portfolio failure

Safe-stop at appropriate scope → incident → controlled recovery.

Never use cross-workspace access as an implicit recovery fallback.

---

# 9. PHASE 4 COMPATIBILITY

Phase 4 remains authoritative.

Portfolio-scale learning may use only explicitly permitted derived signals.

Do not create an implicit portfolio-wide training dataset.

Any optimization affecting protected workspace configuration must continue through:

```text
Evidence → Signal → Proposal → Review → Apply → Version → Measure → Revert/Disable
```

Portfolio aggregation is not automatic policy.

---

# 10. TESTING REQUIREMENTS

Add focused Phase 5 tests and preserve all existing tests.

At minimum test:

### Portfolio/workspace

- multiple workspaces coexist;
- one workspace can be suspended without affecting another;
- archived workspace cannot execute;
- provisioning is isolated and repeatable;
- no credential/data inheritance.

### Routing

- valid routing succeeds through existing governed execution path;
- missing workspace context denied;
- invalid workspace denied;
- suspended/archived destination denied;
- routing cannot bypass policy;
- routing decision audited;
- no silent multi-workspace execution.

### Sharing contracts

- no contract means deny;
- approved active contract allows only declared scope;
- revoked contract denies;
- expired contract denies;
- undeclared data/operation denied;
- secret/credential transfer denied;
- contract lifecycle audited;
- source/destination isolation preserved.

### Capability reuse

- governed reuse works only after required approval;
- target workspace authorization required;
- source credentials not inherited;
- private source data not copied;
- provenance preserved.

### Portfolio observability

- owner can read portfolio aggregates;
- workspace-private raw data is not leaked;
- aggregate metrics retain scope/provenance;
- unauthorized portfolio access denied.

### Resource governance

- per-workspace limits enforced;
- portfolio limit enforced;
- limit breach deterministic and audited;
- resource exhaustion cannot produce false success;
- one workspace cannot silently bypass limits.

### Regression/security

- all Phase 0–4 tests remain green;
- no secret leakage;
- no policy bypass;
- no isolation regression;
- no unsafe retry/recovery regression;
- no learning-boundary regression.

Use deterministic tests. Do not depend on external providers unless the existing test architecture explicitly requires them.

---

# 11. REQUIRED VALIDATION COMMANDS

After implementation, discover and run the repository's actual commands. At minimum, if available:

```bash
npm run db:migrate:local
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

If scripts differ, use the repository's actual equivalents and document them.

Do not claim success from static inspection alone.

---

# 12. ACCEPTANCE EVIDENCE

Create a repository document for Phase 5 acceptance evidence, using the next available docs filename.

It must record:

- implementation summary;
- migrations executed;
- tests executed and counts;
- Phase 0–4 regression status;
- Phase 5 test status;
- typecheck/build status;
- dependency/security audit status;
- security/isolation evidence;
- routing evidence;
- sharing-contract evidence;
- capability-reuse evidence;
- portfolio-observability evidence;
- resource-governance evidence;
- known limitations;
- exact commit SHA after implementation.

Do not fabricate evidence. If something cannot be verified, mark it explicitly as unverified.

---

# 13. IMPLEMENTATION DISCIPLINE

Rules:

1. Make the smallest coherent change that satisfies the Phase 5 specification.
2. Preserve existing architecture and naming conventions.
3. Prefer extending existing services/domain modules over parallel implementations.
4. Do not duplicate execution engines.
5. Do not duplicate workspace identity.
6. Keep business-private data workspace-scoped.
7. Keep credentials outside learning/portfolio/sharing records.
8. Use explicit contracts for cross-workspace operations.
9. Re-check authorization and current state immediately before protected mutations.
10. Preserve append-only audit semantics.
11. Preserve idempotency and safe-stop behavior.
12. Keep new APIs backward compatible unless a breaking change is explicitly required and documented.
13. Avoid speculative infrastructure.
14. Avoid broad refactors unrelated to Phase 5.

If an ambiguity exists, choose the option that maximizes isolation, explicit authorization, auditability, and backward compatibility.

---

# 14. COMPLETION GATE

Phase 5 is complete only if all of the following are true:

- multiple independent workspaces operate through the same core model;
- workspace lifecycle remains isolated;
- provisioning is repeatable and least-privilege;
- routing is explicit and governed;
- invalid workspace context is denied;
- cross-workspace sharing is default-deny;
- active sharing contracts are explicit, scoped, versioned, and auditable;
- revoked/expired contracts fail closed;
- capability reuse is governed;
- credentials/private data are not implicitly transferred;
- portfolio reporting is owner-authorized and privacy-preserving;
- resource/concurrency limits are enforced and auditable;
- protected mutations re-check authorization/current state;
- Phase 3 safety/recovery invariants remain intact;
- Phase 4 learning/provenance/reversibility invariants remain intact;
- migrations pass;
- typecheck passes;
- all tests pass;
- Phase 0–4 regression tests pass;
- build passes;
- dependency/security audit passes;
- acceptance evidence is committed.

If any mandatory gate fails, do not report Phase 5 as complete.

---

# 15. GIT / DELIVERY RULE

Work directly on the repository's current working branch unless the repository workflow clearly requires another branch.

Before commit:

- inspect `git diff`;
- ensure no unrelated changes are included;
- ensure secrets are not present;
- ensure only Phase 5 scope is changed.

Commit with a clear message such as:

`feat: implement Phase 5 portfolio scale`

Push the verified implementation to the configured remote.

Return a concise completion report containing:

1. commit SHA;
2. files changed;
3. migrations;
4. test counts/results;
5. typecheck/build/audit results;
6. Phase 0–4 regression result;
7. Phase 5 acceptance result;
8. known limitations;
9. whether the repository is ready for owner review.

Never claim a push, test, deployment, or acceptance gate passed unless it was actually verified.

---

# FINAL OPERATING PRINCIPLE

HALSTRAL must become more capable at portfolio scale without becoming less governable.

> One Owner → One Orchestration Core → Many Independent Businesses → Separate Workspaces

> Isolate by default. Delegate explicitly. Share minimally. Audit continuously.

Implement Phase 5 accordingly.
