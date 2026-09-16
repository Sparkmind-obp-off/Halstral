# HALSTRAL Phase 1 Acceptance Criteria

## 1. Purpose

This document defines the testable gate for declaring HALSTRAL Phase 1 complete.

Phase 1 is a control-plane and registry milestone. Passing this document does not authorize autonomous external execution.

## 2. PASS Criteria

### AC-01 — Workspace creation

Owner can create a workspace with a unique ID/slug, name, owner, environment, and valid status.

Expected result: workspace is persisted and `WORKSPACE_CREATED` is recorded.

### AC-02 — Workspace inspection

Owner can retrieve one workspace and list available workspaces.

Expected result: only authorized workspace information is returned.

### AC-03 — Workspace update

Owner can update permitted workspace metadata.

Expected result: mutation succeeds only through the authorization path and produces `WORKSPACE_UPDATED`.

### AC-04 — Workspace suspension

Owner can suspend an active workspace.

Expected result: status becomes `SUSPENDED`, an audit event is recorded, and execution requests are denied while suspended.

### AC-05 — Workspace archival

Owner can archive a workspace.

Expected result: status becomes `ARCHIVED`, an audit event is recorded, and new tasks are rejected.

### AC-06 — Capability registration

Owner can register a capability with explicit ownership scope, risk level, input/output contract, and status.

Expected result: capability is persisted and `CAPABILITY_CREATED` is recorded.

### AC-07 — Capability disablement

Owner can disable a capability.

Expected result: disabled capability cannot be authorized for new use and `CAPABILITY_DISABLED` is recorded.

### AC-08 — Policy creation

Owner can create an explicit `ALLOW` or `DENY` policy with subject, resource, action, scope, and approval requirement.

Expected result: policy is persisted and auditable.

### AC-09 — Default deny

When no applicable authorization rule exists, the authorization result is `DENY`.

Expected result: protected operation is rejected and `AUTHORIZATION_DENIED` is recorded.

### AC-10 — Cross-workspace isolation

A workspace cannot read or mutate another workspace's protected resources without explicit authorization.

Expected result: unauthorized cross-workspace access is denied and audited.

### AC-11 — Task registration

Owner can create a task belonging to a valid, active workspace.

Expected result: task receives a valid lifecycle state and `TASK_CREATED` is recorded.

### AC-12 — Task lifecycle

Task status can move only through defined, valid transitions.

Expected result: invalid transitions are rejected; valid mutations are auditable.

### AC-13 — Run registration

A run can be registered against a task without requiring the full Phase 2 execution engine.

Expected result: run receives a valid lifecycle state and `RUN_CREATED` is recorded.

### AC-14 — Audit trail

Protected mutations and authorization decisions generate structured audit events containing actor, workspace, resource, timestamp, event type, and relevant metadata.

Expected result: audit history is available for inspection and is not mutable through normal business flows.

### AC-15 — Secret protection

No plaintext production credentials, tokens, API keys, or secrets are committed to the repository or stored as ordinary application records.

Expected result: only secret references are persisted where required.

### AC-16 — API contract

Minimum Phase 1 API routes for workspaces, capabilities, policies, tasks, runs, and events are implemented or explicitly documented as pending where the chosen architecture does not expose HTTP directly.

Expected result: the implementation maps cleanly to the domain contract in `04_PHASE_0_1_SPECIFICATION.md`.

### AC-17 — Automated security tests

Automated tests cover at least workspace isolation, default deny, unauthorized capability use, suspended workspace restrictions, archived workspace restrictions, and audit generation.

Expected result: tests pass in the documented test environment.

### AC-18 — No autonomous external action

Phase 1 must not autonomously send messages, perform financial transactions, modify external production systems, or execute arbitrary external actions.

Expected result: such behavior is absent or explicitly blocked.

## 3. Phase Gate

Phase 1 status may be declared **PASS** only when all mandatory criteria above are satisfied and the implementation has reproducible test evidence.

```text
ALL REQUIRED TESTS PASS
        ↓
SECURITY BOUNDARIES VERIFIED
        ↓
AUDIT VERIFIED
        ↓
SECRETS VERIFIED
        ↓
PHASE 1 PASS
        ↓
PHASE 2 MAY BEGIN
```

If any mandatory criterion fails, Phase 1 remains open until the failure is resolved and retested.

## 4. Evidence Required

Before declaring Phase 1 PASS, retain:

- test command(s)
- test results
- API/schema documentation
- database migration or schema evidence
- security-test evidence
- audit-event evidence
- secret-handling evidence
- implementation commit SHA

## 5. Final Phase 1 Definition of Done

HALSTRAL can be declared Phase 1 complete when its control plane can register and govern independent business workspaces, capabilities, policies, tasks, and runs; enforce default-deny authorization and workspace isolation; and provide an auditable record of protected changes — without introducing autonomous external execution.
