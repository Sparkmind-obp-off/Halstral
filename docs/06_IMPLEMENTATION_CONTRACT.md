# HALSTRAL Implementation Contract

## 1. Purpose

This document defines what an implementation agent may choose and what it must not change while implementing HALSTRAL Phase 0 → Phase 1.

## 2. Implementation Freedom

The implementation agent may choose:

- programming language
- API framework
- database engine
- ORM/query layer
- validation library
- test framework
- project tooling
- local development workflow

The selected stack must be documented and reproducible.

## 3. Immutable Product Contracts

The implementation must preserve:

1. HALSTRAL identity as a private Business Orchestration Core.
2. One owner controlling multiple independent business workspaces.
3. Workspace isolation.
4. Default-deny authorization.
5. Explicit capability ownership/scope.
6. Explicit policy evaluation.
7. Auditable protected mutations and authorization decisions.
8. Secret-reference rather than plaintext-secret handling.
9. Phase 1 non-goal of autonomous external execution.
10. Phase-gated progression to Phase 2.

## 4. Domain Contracts

The following concepts are mandatory even if implementation names differ internally:

- Workspace
- Capability
- Policy
- Task
- Run
- Event/Audit

Required lifecycle states and security semantics are defined in `04_PHASE_0_1_SPECIFICATION.md`.

## 5. Authorization Boundary

All protected operations must pass through an authorization boundary before persistence or execution.

```text
REQUEST
  ↓
ACTOR
  ↓
WORKSPACE
  ↓
RESOURCE
  ↓
POLICY EVALUATION
  ↓
ALLOW / DENY
  ↓
AUDIT
  ↓
PERSIST / CONTINUE
```

A direct application path that bypasses policy evaluation is not acceptable for protected operations.

## 6. Workspace Boundary

Every business-specific resource must have an unambiguous workspace relationship where applicable.

Cross-workspace access must be explicit, scoped, authorized, and auditable.

There must be no hidden global access path that accidentally exposes one business to another.

## 7. Secrets Boundary

Production secrets must be supplied through an appropriate secret/environment mechanism.

Do not:

- hard-code credentials
- commit `.env` production files
- place API keys in fixtures
- store plaintext production tokens in database seed data
- expose secrets in logs

Use references such as:

```text
secret://workspace/<workspace>/<credential>
```

when a domain object needs to identify a credential without containing its value.

## 8. API Compatibility

If an HTTP API is selected, it should implement the route surface defined in the Phase 0 → Phase 1 specification.

If a different interface is selected, it must provide equivalent operations and document the mapping.

## 9. Testing Contract

The implementation must include automated coverage for:

- workspace isolation
- default deny
- unauthorized capability access
- suspended workspace restrictions
- archived workspace restrictions
- policy evaluation
- audit generation
- task/run lifecycle validation
- secret leakage prevention where practical

Tests must be reproducible by another operator from the repository instructions.

## 10. Observability Contract

At minimum, protected mutations and authorization decisions must be traceable to:

- actor
- workspace
- resource
- action/event type
- timestamp
- outcome

Do not log secret values.

## 11. Migration and Data Integrity

Schema changes must be represented through reproducible migrations or equivalent versioned mechanisms.

Seed/demo data must be clearly separated from production credentials and must not weaken authorization boundaries.

## 12. Documentation Contract

The implementation must update documentation when a concrete technical decision materially affects operation, security, deployment, or testing.

At minimum, document:

- selected stack
- setup commands
- environment variables
- migration commands
- test commands
- API access
- security assumptions

## 13. Agent Guardrails

An implementation agent must not:

- rename HALSTRAL without explicit owner approval
- remove workspace isolation
- weaken default-deny behavior
- silently introduce global credentials
- add autonomous external actions to Phase 1
- delete audit history to hide failures
- commit secrets
- claim Phase 1 PASS without evidence

## 14. Completion Rule

The implementation is complete only when it satisfies `05_ACCEPTANCE_CRITERIA.md` and provides reproducible evidence for the Phase 1 gate.
