# HALSTRAL — Genspark Phase 0 → Phase 1 Master Implementation Prompt

## ROLE

You are the implementation engineer for the private HALSTRAL repository.

Repository:
`Sparkmind-obp-off/Hastral`

System:
**HALSTRAL — Private Business Orchestration Core**

Your job is to implement Phase 0 → Phase 1 from the repository contracts, not to redesign the product.

## SOURCE OF TRUTH

Read these documents first, in order:

1. `README.md`
2. `docs/00_SYSTEM_CHARTER.md`
3. `docs/01_ARCHITECTURE_BLUEPRINT.md`
4. `docs/02_SECURITY_AND_OWNERSHIP.md`
5. `docs/03_ROADMAP.md`
6. `docs/04_PHASE_0_1_SPECIFICATION.md`
7. `docs/05_ACCEPTANCE_CRITERIA.md`
8. `docs/06_IMPLEMENTATION_CONTRACT.md`

If implementation choices conflict with a product/security contract, preserve the contract and document the technical choice.

## MISSION

Implement a minimal, secure HALSTRAL control plane that can:

- register and inspect independent business workspaces
- register and govern capabilities
- create and evaluate explicit policies
- register tasks
- register execution runs
- record protected mutations and authorization decisions
- enforce workspace isolation
- enforce default-deny authorization

Do not build autonomous external execution in this phase.

## CORE MODEL

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

The fundamental architecture is:

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

## IMPLEMENTATION RULES

1. You may choose the concrete programming stack.
2. Prefer a simple, maintainable implementation over unnecessary infrastructure.
3. Keep domain logic independent from framework-specific code where practical.
4. Keep workspace boundaries explicit in the domain and persistence layer.
5. Centralize authorization decisions rather than duplicating security logic across endpoints.
6. Make audit generation systematic for protected mutations and authorization decisions.
7. Never store production secrets in source control or ordinary domain records.
8. Use environment/secret references for credentials.
9. Add automated tests before declaring completion.
10. Do not claim Phase 1 PASS until all acceptance criteria are demonstrated.

## REQUIRED DOMAIN MODULES

Implement the equivalent of:

- Workspace Registry
- Capability Registry
- Policy Registry
- Task Registry
- Run Registry
- Event/Audit Registry

Required lifecycle values and operations are defined in `04_PHASE_0_1_SPECIFICATION.md`.

## REQUIRED SECURITY BEHAVIOR

### Default deny

If there is no applicable explicit authorization, return `DENY`.

### Workspace isolation

A workspace cannot access another workspace's protected resources unless an explicit policy grants the access.

### Suspended workspace

A suspended workspace cannot execute actions.

### Archived workspace

An archived workspace cannot receive new tasks.

### Disabled capability

A disabled capability cannot be newly authorized for use.

### Audit

Record authorization outcomes and protected mutations with sufficient actor/workspace/resource context.

### Secrets

Never expose secret values in source, fixtures, logs, API responses, or audit metadata.

## REQUIRED API

If using HTTP, implement the minimum route surface in `04_PHASE_0_1_SPECIFICATION.md`:

- `/workspaces`
- `/capabilities`
- `/policies`
- `/tasks`
- `/runs`
- `/events`

Use conventional HTTP semantics and validation.

## REQUIRED TEST MATRIX

Create automated tests for at least:

1. create/list/get/update workspace
2. suspend workspace
3. archive workspace
4. reject execution for suspended workspace
5. reject new task for archived workspace
6. create capability
7. disable capability
8. create explicit allow policy
9. create explicit deny policy
10. default-deny when no policy matches
11. reject unauthorized cross-workspace access
12. permit explicitly authorized access
13. create task and validate lifecycle
14. register run and validate lifecycle
15. generate audit events
16. ensure audit records are not normally mutable
17. ensure secrets are not persisted/logged as plaintext

## REQUIRED DOCUMENTATION OUTPUT

After implementation, create or update documentation with:

- chosen stack and rationale
- project structure
- setup instructions
- environment variables
- migration/database instructions
- test commands
- API usage
- security assumptions
- known limitations

## PROHIBITED SCOPE

Do NOT add the following merely because they may be useful later:

- autonomous social posting
- autonomous email/message sending
- financial transactions
- unrestricted browser automation
- arbitrary remote code execution
- automatic cross-workspace credential sharing
- agent-to-agent unrestricted communication
- a general-purpose AI assistant
- a public SaaS billing system
- speculative Phase 2/3 features that complicate the foundation

If a future capability is needed for architecture validation, implement only a mocked/internal boundary and clearly label it as non-production.

## IMPLEMENTATION SEQUENCE

Follow this sequence:

### Step 1 — Inspect

Read all source-of-truth documents and inspect the current repository state.

### Step 2 — Decide stack

Choose the smallest production-sensible stack that supports the contracts. Document the decision.

### Step 3 — Scaffold

Create the application/package/test structure.

### Step 4 — Domain

Implement workspace, capability, policy, task, run, and event domain models.

### Step 5 — Persistence

Implement schema/migrations/repositories with workspace relationships and integrity constraints.

### Step 6 — Authorization

Implement centralized policy evaluation with default deny.

### Step 7 — API/control plane

Implement the required registry operations.

### Step 8 — Audit

Ensure protected mutations and authorization decisions produce audit events.

### Step 9 — Security tests

Run the full security test matrix.

### Step 10 — Acceptance gate

Run every criterion in `05_ACCEPTANCE_CRITERIA.md`.

### Step 11 — Final report

Report:

- implementation summary
- selected stack
- files changed
- migration status
- test command
- test result
- security test result
- acceptance criteria result
- remaining limitations
- commit SHA

Do not state `PHASE 1 PASS` unless all mandatory criteria pass.

## DEFINITION OF DONE

The system must provide a working control plane where the owner can govern independent business workspaces and their capabilities, policies, tasks, and run records, with default-deny authorization, workspace isolation, and an auditable history.

Phase 2 remains gated until this definition of done and all acceptance criteria are satisfied.
