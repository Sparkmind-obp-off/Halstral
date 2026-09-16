# HALSTRAL Phase 0 → Phase 1 Specification

## 1. Purpose

This document defines the implementation contract for the HALSTRAL foundation and core registry phases.

- **Phase 0 — Foundation:** establish identity, architecture, ownership, security, workspace boundaries, domain contracts, repository conventions, and acceptance criteria.
- **Phase 1 — Core Registry:** implement the minimum control plane for registering, inspecting, governing, updating, disabling, and archiving business workspaces and capabilities, while keeping autonomous execution out of scope.

Phase 1 is a registry/control-plane milestone, not an autonomous agent platform.

## 2. Canonical Principle

```text
One Owner
     ↓
One HALSTRAL Core
     ↓
Many Independent Workspaces
     ↓
Explicit Capabilities
     ↓
Explicit Policies
     ↓
Auditable Actions
```

Default authorization behavior is **DENY**.

## 3. Phase 0 Identity Contract

```yaml
system:
  name: HALSTRAL
  role: Private Business Orchestration Core
  visibility: private
  ownership: owner-controlled
```

Canonical description:

> HALSTRAL is a private business orchestration core that enables one owner to coordinate, delegate, operate, observe, learn, and improve across multiple independent businesses while preserving workspace isolation.

## 4. Workspace Model

Each independent business is represented as a workspace.

```text
HALSTRAL
├── merovia
├── sparkmind
├── business-c
└── future-business
```

A workspace is both an operational boundary and a security boundary.

Minimum attributes:

```yaml
workspace:
  id
  slug
  name
  description
  status
  owner_id
  environment
  created_at
  updated_at
```

Status values:

- `ACTIVE`
- `SUSPENDED`
- `ARCHIVED`

Rules:

- Slugs are unique.
- Archived workspaces cannot receive new tasks.
- Suspended workspaces cannot execute actions.
- Cross-workspace access requires explicit authorization.

## 5. Ownership Hierarchy

```text
OWNER
  ↓
HALSTRAL
  ↓
WORKSPACE
  ↓
CAPABILITY
  ↓
TASK
  ↓
RUN
  ↓
EVENT
```

The owner remains the highest authority. HALSTRAL must not autonomously alter ownership or authority hierarchy.

## 6. Data and Credential Isolation

Workspace A must not access Workspace B by default. Cross-workspace access requires explicit permission, defined scope, and an audit event.

Credentials are not ordinary business data. Store references to secrets rather than plaintext credentials.

```json
{
  "credential_ref": "secret://workspace/merovia/threads_api"
}
```

Secrets must never be committed to source control.

## 7. Event Contract

```yaml
event:
  id
  type
  actor
  workspace_id
  resource_type
  resource_id
  timestamp
  metadata
```

Initial event types:

- `WORKSPACE_CREATED`
- `WORKSPACE_UPDATED`
- `WORKSPACE_SUSPENDED`
- `WORKSPACE_ARCHIVED`
- `CAPABILITY_CREATED`
- `CAPABILITY_UPDATED`
- `CAPABILITY_DISABLED`
- `POLICY_CREATED`
- `POLICY_UPDATED`
- `TASK_CREATED`
- `TASK_UPDATED`
- `RUN_CREATED`
- `RUN_STARTED`
- `RUN_COMPLETED`
- `RUN_FAILED`
- `AUTHORIZATION_GRANTED`
- `AUTHORIZATION_DENIED`

Audit records are logically immutable; normal application flows must not update historical audit events.

## 8. Phase 1 Core Registries

Phase 1 contains six logical registries:

1. Workspace Registry
2. Capability Registry
3. Policy Registry
4. Task Registry
5. Run Registry
6. Event/Audit Registry

### 8.1 Workspace Registry

Required operations:

- `CREATE`
- `GET`
- `LIST`
- `UPDATE`
- `SUSPEND`
- `ARCHIVE`

Example:

```json
{
  "id": "ws_merovia",
  "slug": "merovia",
  "name": "Merovia",
  "status": "ACTIVE"
}
```

### 8.2 Capability Registry

A capability describes something HALSTRAL or a workspace is permitted to do.

Examples:

- `research.web`
- `generate.document`
- `github.read`
- `github.write`
- `social.search`
- `data.analyze`
- `notification.send`

Schema:

```yaml
capability:
  id
  name
  description
  owner_scope
  risk_level
  input_schema
  output_schema
  status
  created_at
  updated_at
```

Status values:

- `ACTIVE`
- `DISABLED`
- `DEPRECATED`

Ownership scope must distinguish core capabilities from workspace-owned capabilities. Not every capability is global.

### 8.3 Policy Registry

A policy defines who may perform which action on which resource within which scope.

```yaml
policy:
  id
  name
  subject
  resource
  action
  scope
  effect
  approval_required
  status
```

Effect values:

- `ALLOW`
- `DENY`

Default effect when no applicable allow rule exists: `DENY`.

### 8.4 Task Registry

A task represents requested work.

```json
{
  "id": "task_001",
  "workspace_id": "ws_merovia",
  "title": "Research competitor",
  "status": "PENDING"
}
```

Task statuses:

- `PENDING`
- `CLASSIFIED`
- `DELEGATED`
- `BLOCKED`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

Phase 1 models task state. Full execution belongs to Phase 2.

### 8.5 Run Registry

A run is an execution instance associated with a task.

```yaml
run:
  id
  task_id
  workspace_id
  status
  started_at
  completed_at
  error
```

Run statuses:

- `CREATED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

Phase 1 permits registration of runs but does not require a full execution engine.

## 9. API Contract

Minimum API surface:

### Workspaces

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:id`
- `PATCH /workspaces/:id`
- `POST /workspaces/:id/suspend`
- `POST /workspaces/:id/archive`

### Capabilities

- `GET /capabilities`
- `POST /capabilities`
- `GET /capabilities/:id`
- `PATCH /capabilities/:id`
- `POST /capabilities/:id/disable`

### Policies

- `GET /policies`
- `POST /policies`
- `GET /policies/:id`
- `PATCH /policies/:id`

### Tasks

- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `POST /tasks/:id/cancel`

### Runs

- `GET /runs`
- `GET /runs/:id`

### Events

- `GET /events`
- `GET /events/:id`

## 10. Authorization Flow

Every protected mutation should conceptually follow:

```text
REQUEST
  ↓
IDENTIFY ACTOR
  ↓
IDENTIFY WORKSPACE
  ↓
IDENTIFY RESOURCE
  ↓
CHECK POLICY
  ↓
ALLOW / DENY
  ↓
AUDIT EVENT
```

The system must not permit a direct request-to-database-write bypass of policy enforcement.

## 11. Minimal Data Model

Core entities:

- `users`
- `workspaces`
- `capabilities`
- `policies`
- `tasks`
- `runs`
- `events`

Relationship model:

```text
USER
 │
 └── WORKSPACES
       │
       ├── CAPABILITIES
       ├── POLICIES
       └── TASKS
              │
              └── RUNS

All mutations
       ↓
     EVENTS
```

## 12. Initial Repository Architecture

The implementation may choose the concrete framework and database, but must preserve the contracts in this document.

```text
Hastral/
├── README.md
├── docs/
│   ├── 00_SYSTEM_CHARTER.md
│   ├── 01_ARCHITECTURE_BLUEPRINT.md
│   ├── 02_SECURITY_AND_OWNERSHIP.md
│   ├── 03_ROADMAP.md
│   ├── 04_PHASE_0_1_SPECIFICATION.md
│   └── 05_ACCEPTANCE_CRITERIA.md
│
├── apps/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── policy/
│   ├── audit/
│   └── shared/
│
├── tests/
│
├── .env.example
└── .gitignore
```

## 13. Security Test Requirements

The implementation must test at least:

**A. Workspace isolation** — Merovia cannot access SparkMind data without explicit authorization.

**B. Unauthorized capability** — a workspace attempting to use a capability owned by another workspace is denied unless explicitly authorized.

**C. Suspended workspace** — execution requests are denied while the workspace is suspended.

**D. Archived workspace** — new tasks cannot be created for an archived workspace.

**E. Default deny** — a capability without explicit authorization cannot be used.

**F. Audit** — protected successful and denied mutations produce appropriate audit events.

## 14. Explicit Non-Goals for Phase 1

Phase 1 must not expand into:

- autonomous external actions
- a general-purpose AI assistant
- a production automation engine
- a cross-business data lake
- arbitrary code execution
- automatic credential sharing
- autonomous financial actions
- unrestricted agent-to-agent communication

These belong to later phases only when explicitly designed and gated.

## 15. Phase Gate

```text
PHASE 0
  ↓
FOUNDATION READY
  ↓
PHASE 1 BUILD
  ↓
CORE REGISTRIES
  ↓
SECURITY TESTS
  ↓
ACCEPTANCE TESTS
  ├── PASS → PHASE 2 READY
  └── FAIL → FIX
```

Phase 2 should not begin until Phase 1 passes its acceptance criteria.

## 16. Definition of Done

HALSTRAL Phase 1 is complete when the control plane can reliably represent:

- the owner's businesses/workspaces
- available capabilities
- applicable policies
- registered work
- execution run records
- auditable changes

while preserving isolation between businesses and enforcing default-deny authorization.
