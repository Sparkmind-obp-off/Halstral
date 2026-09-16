# HALSTRAL — Security & Ownership Contract

## Security posture

HALSTRAL is private infrastructure. The default security model is least privilege and workspace isolation.

## Ownership hierarchy

```text
OWNER
  ↓
HALSTRAL CONTROL PLANE
  ↓
BUSINESS WORKSPACE
  ↓
AGENT / WORKFLOW
  ↓
TOOL / CONNECTOR
```

Each layer receives only the authority required for its role.

## Core rules

1. Workspace data is isolated by default.
2. Credentials are scoped to the smallest practical execution context.
3. Cross-workspace access requires explicit authorization.
4. High-impact actions require policy evaluation and, where configured, owner approval.
5. Every sensitive execution should produce an auditable event.
6. Secrets must never be committed to Git.
7. Development, staging, and production credentials must remain separated.
8. Failed or ambiguous actions should fail closed when the potential impact is high.

## Approval classes

### Class A — Low impact

Examples: internal analysis, draft generation, non-destructive organization.

May execute automatically when policy permits.

### Class B — External but reversible

Examples: sending a prepared message, creating a draft external resource, reversible configuration changes.

May require policy checks and optional owner approval.

### Class C — High impact / irreversible

Examples: financial commitments, destructive changes, publishing sensitive information, changing security controls.

Requires explicit owner approval unless a separately documented emergency policy exists.

## Audit requirements

At minimum record:

- actor;
- workspace;
- requested action;
- authorization context;
- tool/connector used;
- execution status;
- timestamp;
- result or error;
- approval reference when applicable.

## Secret handling

Use environment/secret-management mechanisms appropriate to the deployment environment. Never store API keys, tokens, passwords, private keys, or session cookies in source control.

## External connectors

Connectors must have explicit contracts defining:

- ownership;
- authentication method;
- scopes;
- permitted actions;
- input/output schema;
- rate limits;
- failure behavior;
- audit requirements;
- revocation path.

## Security evolution

Security controls should be strengthened as HALSTRAL gains autonomous execution capabilities. Automation must never silently expand its own authority.
