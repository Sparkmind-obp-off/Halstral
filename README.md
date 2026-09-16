# HALSTRAL

**Private Business Orchestration Core**

HALSTRAL is an owner-controlled control plane for governing multiple independent business workspaces without collapsing their data, credentials, or authority into a shared monolith.

> One Owner. One Orchestration Core. Many Independent Businesses. Separate Workspaces.

## Phase 1 status

The Phase 0 → Phase 1 core registry is implemented with:

- workspace registration, inspection, metadata updates, suspension, and archival;
- core/workspace-owned capability registration and disablement;
- explicit `ALLOW`/`DENY` policies with centralized default-deny evaluation;
- task and run registration with validated lifecycle transitions;
- cross-workspace isolation and explicit authorization;
- structured, append-only authorization and mutation audit events;
- plaintext-secret rejection and scoped `secret://` references;
- an authenticated Hono HTTP control plane backed by Cloudflare D1;
- 19 automated domain, API, audit, isolation, and security tests.

HALSTRAL Phase 1 does **not** execute external actions.

## Stack

- TypeScript
- Hono
- Cloudflare Pages/Workers
- Cloudflare D1 (SQLite)
- Vite
- Vitest

See [`docs/08_IMPLEMENTATION_GUIDE.md`](./docs/08_IMPLEMENTATION_GUIDE.md) for the rationale and full operating guide.

## Quick start

```bash
npm install
cp .env.example .dev.vars
# Add a strong CONTROL_PLANE_TOKEN to .dev.vars
npm run db:migrate:local
npx wrangler d1 execute halstral-production --local --file=./seed.sql
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/health
```

`.dev.vars`, `.env*`, build output, local D1 state, logs, and archives are excluded from Git.

## Environment variables

- `CONTROL_PLANE_TOKEN` — required private API bearer token; provision as a Cloudflare Pages secret.
- `OWNER_ID` — optional owner identifier, default `owner_halstral`.

## API entry URIs

- Public: `GET /`, `GET /health`
- Workspaces: `/workspaces`, `/workspaces/:id`, `/workspaces/:id/suspend`, `/workspaces/:id/archive`
- Capabilities: `/capabilities`, `/capabilities/:id`, `/capabilities/:id/disable`
- Policies: `/policies`, `/policies/:id`
- Tasks: `/tasks`, `/tasks/:id`, `/tasks/:id/cancel`
- Runs: `/runs`, `/runs/:id`
- Audit: `/events`, `/events/:id`

Protected routes require `Authorization: Bearer <token>` and accept `X-Actor-Type`/`X-Actor-Id` for auditable owner-controlled delegation context.

## Data architecture

D1 tables: `users`, `workspaces`, `capabilities`, `policies`, `tasks`, `runs`, and `events`. Every business-specific resource has an explicit workspace relationship where applicable. Database constraints enforce statuses and ownership shape; triggers block event update/delete.

Migration:

```bash
npm run db:migrate:local
# Production after D1 binding is provisioned:
npx wrangler d1 migrations apply halstral-production --remote
```

## Quality gate

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

Acceptance evidence is maintained in [`docs/09_PHASE_1_ACCEPTANCE_EVIDENCE.md`](./docs/09_PHASE_1_ACCEPTANCE_EVIDENCE.md).

## User guide

1. Provision the control-plane token and owner ID.
2. Create independent workspaces as the owner.
3. Register capabilities with `CORE` or `WORKSPACE` ownership.
4. Create explicit policies for delegated workspace actors; absence of a match is denied.
5. Register tasks only in active workspaces and runs only where execution registration is permitted.
6. Inspect `/events` as the owner for authorization and mutation history.

## Deployment

- Platform: Cloudflare Pages + D1
- Production URL: pending first BYOK deployment
- Repository: `https://github.com/Sparkmind-obp-off/Hastral`
- Production status: build verified; deployment pending

## Not implemented / known limitations

- No autonomous connector, messaging, financial, browser, or remote-code execution.
- No Phase 2 workflow execution engine.
- Managed identity federation, rate limiting, pagination, and approval-reference workflows remain future hardening work.

## Recommended next steps

1. Operate and review the Phase 1 registry/audit boundary in a private environment.
2. Add managed identity and key rotation before expanding operator access.
3. Begin Phase 2 only through a separately reviewed connector and approval contract.

See [`docs/`](./docs/) for the immutable system charter, architecture, security contract, specification, and acceptance gate.
