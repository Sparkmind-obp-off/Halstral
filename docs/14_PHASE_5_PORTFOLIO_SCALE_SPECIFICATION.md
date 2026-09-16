# HALSTRAL — Phase 5 Portfolio Scale Specification

## 1. Purpose

Phase 4 established controlled learning: HALSTRAL can capture verified outcomes, derive traceable signals, propose improvements, apply reviewed changes, measure results, and recover through bounded controls.

Phase 5 extends that governed core from an execution/learning system into a portfolio-scale orchestration layer for multiple independent businesses.

Canonical objective:

> Scale the portfolio without collapsing business boundaries.

HALSTRAL must allow one owner to coordinate many businesses while preserving independent workspaces, explicit delegation, least privilege, controlled sharing, auditable governance, bounded resource use, and all Phase 0–4 safety invariants.

Canonical principle:

> One Owner → One Orchestration Core → Many Independent Businesses → Separate Workspaces

Canonical boundary:

> HALSTRAL coordinates businesses; it does not become the business.

The existing `workspaces` model remains the authoritative execution boundary unless implementation evidence proves that a separate portfolio/business registry is necessary. Do not duplicate workspace identity merely to introduce a portfolio concept.

---

## 2. Phase 5 Scope

Phase 5 introduces portfolio-scale governance around existing workspace, capability, task, execution, observability, recovery, and learning domains.

The implementation must support:

1. repeatable workspace/business provisioning;
2. workspace lifecycle management at portfolio scale;
3. controlled task routing and delegation;
4. explicit cross-workspace sharing contracts;
5. governed reuse of promoted capabilities;
6. portfolio-level reporting and health views;
7. bounded resource and concurrency governance;
8. owner-level portfolio controls;
9. stronger isolation and context propagation;
10. scalable queries, pagination, indexes, and operational limits where needed;
11. complete auditability of portfolio governance actions;
12. preservation of Phase 0–4 contracts and regressions.

Phase 5 is an orchestration-scale expansion, not a rewrite of the core.

---

## 3. Portfolio Model

HALSTRAL is the private orchestration core owned by one owner. Businesses remain independent operating domains.

Conceptually:

```text
OWNER
  ↓
HALSTRAL — PRIVATE BUSINESS ORCHESTRATION CORE
  ↓
PORTFOLIO GOVERNANCE
  ├── Merovia Workspace
  ├── SparkMind Workspace
  ├── Future Business Workspace
  └── Future Business Workspace
```

A business is represented by an independent workspace unless the current domain model requires additional portfolio metadata.

Minimum portfolio-level metadata should be limited to what is necessary for governance, for example:

- workspace/business identity;
- display name and metadata;
- lifecycle state;
- ownership reference;
- creation/update timestamps;
- operational health summary;
- resource policy reference;
- governance status.

Do not copy workspace-private operational data into a global portfolio record.

---

## 4. Workspace Lifecycle at Portfolio Scale

Existing workspace lifecycle semantics remain authoritative:

```text
REGISTERED → ACTIVE → SUSPENDED → ACTIVE
                    └→ ARCHIVED
```

Portfolio-scale lifecycle management must:

- provision a workspace from a repeatable contract;
- initialize required default policies safely;
- preserve workspace isolation;
- prevent execution for suspended or archived workspaces;
- preserve historical audit records;
- make lifecycle changes owner-authorized and auditable;
- avoid implicit copying of credentials, data, or capabilities from another business.

A new workspace must start with least privilege and explicit capability registration.

---

## 5. Task Routing & Delegation

Portfolio scale requires routing work to the correct independent workspace without turning routing into unrestricted autonomy.

Canonical flow:

```text
OWNER / AUTHORIZED REQUEST
        ↓
TASK INTAKE
        ↓
WORKSPACE ROUTING DECISION
        ↓
WORKSPACE POLICY GATE
        ↓
CAPABILITY / WORKFLOW SELECTION
        ↓
PHASE 2–4 EXECUTION CONTROLS
```

Routing requirements:

- every routed task has an explicit workspace context;
- missing or invalid workspace context is denied;
- routing cannot bypass workspace policy or approval requirements;
- a task cannot silently execute in multiple workspaces;
- cross-workspace execution requires an explicit authorized contract;
- routing decisions are auditable;
- suspended/archived workspaces cannot receive executable work;
- capability selection remains workspace/policy scoped;
- retries, recovery, safe-stop, idempotency, and cancellation remain authoritative.

A portfolio-level router may recommend a destination, but recommendation is not authorization.

---

## 6. Cross-Workspace Sharing Contracts

Cross-workspace sharing is opt-in and default-deny.

A sharing contract must explicitly define, at minimum:

```yaml
sharing_contract:
  id
  source_workspace_id
  destination_workspace_id
  owner
  allowed_data
  allowed_operations
  capability_scope
  policy_requirements
  approval_requirements
  effective_from
  expires_at
  version
  status
  audit_refs
```

Suggested statuses:

`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `ACTIVE`, `REVOKED`, `EXPIRED`, `REJECTED`, `DISABLED`.

Requirements:

1. no contract means no cross-workspace sharing;
2. source and destination must both be valid and active where execution requires them;
3. contract scope must be narrower than or equal to the owner's authority;
4. only explicitly allowed data may cross the boundary;
5. only explicitly allowed operations may be performed;
6. credentials/secrets cannot be transferred by a generic sharing contract;
7. contract creation, approval, activation, use, revocation, and expiry are auditable;
8. revoked or expired contracts fail closed;
9. sharing contracts are versioned;
10. a contract cannot weaken existing safety or security controls.

Cross-workspace sharing must never create an implicit portfolio-wide data pool.

---

## 7. Capability Reuse Governance

Phase 4 capability promotion remains governed in Phase 5.

A promoted capability may become reusable across workspaces only through explicit governance. Promotion does not automatically copy:

- workspace-private data;
- credentials;
- secrets;
- ownership;
- private configuration;
- audit history.

A reuse request must resolve:

- source capability provenance;
- source owner;
- target workspace;
- allowed scope;
- compatibility;
- security contract;
- policy requirements;
- performance evidence;
- approval requirements;
- rollback/disable behavior.

The target workspace must independently authorize and register the capability before execution.

Reusable capability metadata may be shared; private business state must not be shared unless a separate explicit contract authorizes it.

---

## 8. Portfolio-Level Observability

HALSTRAL should provide owner-level portfolio visibility without flattening private workspace data into a common operational store.

Portfolio reporting may aggregate safe metadata and derived metrics such as:

- workspace lifecycle state;
- execution counts;
- success/failure rates;
- latency summaries;
- retry/timeout/recovery rates;
- incident counts and severity summaries;
- capability health;
- resource/concurrency utilization;
- learning/optimization activity;
- governance events.

Aggregation requirements:

- owner-authorized only;
- workspace-aware;
- provenance-preserving;
- no secret exposure;
- no accidental raw private-data aggregation;
- clear distinction between aggregate metrics and source records;
- historical measurements remain attributable to workspace and configuration/version.

Portfolio reporting is a control-plane view, not a replacement for workspace-local observability.

---

## 9. Resource & Concurrency Governance

Multiple businesses must not be able to consume uncontrolled shared resources.

Phase 5 should introduce bounded governance for resources that are actually shared by the core, for example:

- maximum concurrent runs per workspace;
- maximum concurrent runs across the portfolio;
- task/run queue bounds;
- capability invocation limits;
- bounded retry budgets;
- configurable execution budgets where supported;
- fair or explicitly prioritized allocation.

Resource controls must:

- fail closed when limits are missing for protected operations where required;
- never bypass authorization;
- never convert resource exhaustion into false success;
- produce auditable denial/throttling events;
- preserve idempotency and retry safety;
- prevent one workspace from starving the entire portfolio without silently changing owner policy.

Do not introduce billing or autonomous financial decision-making as part of Phase 5.

---

## 10. Owner Control Plane

The owner must be able to inspect and govern portfolio state through authenticated, auditable control paths.

The control plane should expose, at minimum:

- workspace/business inventory;
- lifecycle status;
- portfolio health summary;
- routing decisions;
- active sharing contracts;
- pending/rejected/revoked sharing requests;
- reusable capability status;
- resource/concurrency policies;
- portfolio-level incidents and safe-stop state;
- governance/audit history;
- links/references to workspace-local evidence.

Protected actions include, where implemented:

- provision/register workspace;
- suspend/archive/reactivate workspace;
- approve/reject/revoke sharing contract;
- approve/reject capability reuse;
- change protected resource policies;
- perform portfolio safe-stop or resume operations when supported.

Every protected action must re-check authorization and current state at application time.

---

## 11. Isolation & Security Hardening

Phase 5 must strengthen, not relax, the existing isolation model.

Mandatory invariants:

1. workspace context is explicit and validated;
2. default deny remains authoritative;
3. missing workspace context is denied for workspace-scoped operations;
4. suspended/archived workspaces cannot execute;
5. cross-workspace access requires an explicit contract;
6. secrets never enter portfolio metrics, routing records, sharing metadata, or audit payloads;
7. portfolio aggregation cannot expose workspace-private raw data unintentionally;
8. promoted capabilities cannot inherit source credentials;
9. learning remains workspace-local unless an explicit governed sharing mechanism exists;
10. Phase 3 safe-stop and incident controls remain authoritative;
11. Phase 4 learning controls cannot self-modify portfolio security boundaries;
12. no new global super-capability is introduced merely for portfolio scale.

The implementation must preserve defense in depth rather than relying on a single middleware check.

---

## 12. Data & API Design

Implementation should reuse existing domain entities and routes wherever possible.

Potential Phase 5 API surface may include equivalents of:

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

These are design candidates, not immutable route names. Genspark must inspect the existing API and avoid unnecessary duplication.

All list/report endpoints should support bounded queries and pagination when data volume requires it.

All protected mutations must enforce authentication, authorization, workspace/portfolio scope, current-state checks, and audit emission.

---

## 13. Data Model Guidance

Possible new persistence concepts include:

- portfolio/business metadata only if needed;
- sharing contracts;
- routing records;
- portfolio resource policies;
- portfolio metric snapshots where derived persistence is justified.

Before adding a table, verify that an existing entity cannot represent the requirement safely.

Do not create duplicate business/workspace identity tables merely for naming convenience.

Any new record must have:

- stable identifier;
- ownership/scope fields;
- timestamps;
- lifecycle/status where relevant;
- provenance where derived from another record;
- versioning where configuration can change;
- indexes appropriate to bounded access patterns;
- migration safety;
- audit coverage for protected transitions.

---

## 14. Portfolio Events

Integrate with the existing append-only event architecture. Suggested Phase 5 events:

- `BUSINESS_REGISTERED`
- `BUSINESS_SUSPENDED`
- `BUSINESS_REACTIVATED`
- `BUSINESS_ARCHIVED`
- `TASK_ROUTED`
- `TASK_ROUTE_DENIED`
- `SHARING_CONTRACT_PROPOSED`
- `SHARING_CONTRACT_APPROVED`
- `SHARING_CONTRACT_ACTIVATED`
- `SHARING_CONTRACT_REVOKED`
- `SHARING_CONTRACT_EXPIRED`
- `SHARING_CONTRACT_REJECTED`
- `CAPABILITY_REUSE_PROPOSED`
- `CAPABILITY_REUSE_APPROVED`
- `CAPABILITY_REUSE_REJECTED`
- `PORTFOLIO_RESOURCE_LIMIT_CHANGED`
- `PORTFOLIO_RESOURCE_LIMIT_REACHED`
- `PORTFOLIO_HEALTH_MEASURED`
- `PORTFOLIO_POLICY_DENIED`

Exact event naming may be adapted to existing conventions. Existing Phase 0–4 events must remain intact and backward compatible.

---

## 15. Failure, Recovery & Safe-Stop

Portfolio scale must preserve Phase 3 behavior.

Examples:

```text
ROUTING FAILURE
  → classify
  → do not execute outside authorized workspace
  → audit

SHARING CONTRACT INVALID/EXPIRED
  → deny
  → audit
  → no fallback to unrestricted access

RESOURCE LIMIT REACHED
  → bounded queue/throttle/deny
  → audit
  → no false success

WORKSPACE SUSPENDED DURING ROUTING/EXECUTION
  → fail closed at the next protected boundary
  → cancel/stop according to existing Phase 3 controls
  → audit

CRITICAL PORTFOLIO FAILURE
  → safe-stop at appropriate scope
  → incident
  → controlled recovery
```

Recovery must never use cross-workspace access as an implicit fallback.

---

## 16. Learning at Portfolio Scale

Phase 4 learning remains authoritative.

Portfolio-level learning may aggregate only explicitly permitted derived signals. It must not silently train or optimize one business from another business's private data.

Permitted portfolio-level optimization candidates include governance and infrastructure patterns such as:

- resource allocation within owner-defined bounds;
- common infrastructure health signals;
- reusable capability performance summaries;
- portfolio routing heuristics based on non-private metadata.

Any optimization that changes a workspace's protected configuration must still pass the Phase 4 proposal/review/application/versioning path.

Observations remain observations; portfolio aggregation does not automatically become policy.

---

## 17. Operational Scaling

Phase 5 should prepare the control plane for multiple workspaces without premature distributed-system complexity.

Required engineering considerations:

- bounded queries;
- pagination;
- deterministic ordering;
- indexes for workspace/status/time access patterns;
- safe migration strategy;
- idempotent provisioning where practical;
- concurrency conflict handling;
- current-state rechecks for protected mutations;
- bounded resource usage;
- backward-compatible API behavior;
- clear failure states.

Do not introduce a distributed architecture, event bus, microservice split, or external queue solely because it sounds scalable. Add infrastructure only where repository evidence demonstrates a need.

---

## 18. Non-Goals

Phase 5 does not introduce:

- public SaaS or external multi-tenant onboarding;
- unrestricted autonomous business operation;
- implicit cross-business data sharing;
- a global credential vault accessible to all workspaces;
- automatic copying of private workspace data;
- autonomous financial decisions or transactions;
- arbitrary remote code execution;
- unrestricted browser automation;
- self-modifying security/policy boundaries;
- automatic promotion of every capability;
- automatic merging of independent businesses into one workspace;
- silent production changes;
- removal of owner governance.

Merovia remains an independent business/vertical and is not converted into HALSTRAL itself.

---

## 19. Acceptance Gate

Phase 5 is accepted only when evidence demonstrates:

1. multiple independent workspaces can be provisioned and managed through the same core without rewriting the orchestration model;
2. workspace lifecycle controls remain isolated and auditable;
3. tasks are routed only to explicitly authorized workspace contexts;
4. invalid/missing workspace context is denied;
5. cross-workspace sharing is default-deny;
6. explicit sharing contracts can be reviewed, activated, audited, and revoked/expired safely;
7. capability reuse remains governed and does not transfer credentials/private data implicitly;
8. portfolio-level reporting is owner-authorized and does not leak workspace-private information;
9. resource/concurrency limits are enforced and audited;
10. protected portfolio controls re-check authorization and current state at application time;
11. Phase 3 failure/recovery/safe-stop invariants remain intact;
12. Phase 4 learning/isolation/reversibility invariants remain intact;
13. new portfolio records and routes are auditable and provenance-aware;
14. migrations are safe and backward compatible;
15. typecheck, tests, build, and dependency/security audit pass;
16. Phase 0–4 regression tests remain green;
17. acceptance evidence is documented in the repository.

---

## 20. Definition of Done

> HALSTRAL can coordinate a growing portfolio of independent businesses through one private orchestration core without collapsing their boundaries: workspaces are provisioned and governed repeatably, routing is explicit, sharing is contract-based, reusable capabilities remain controlled, portfolio health is observable, shared resources are bounded, and all existing security, safety, recovery, audit, and learning controls remain authoritative.

Only after this gate passes should HALSTRAL move beyond portfolio-scale governance into any future expansion.
