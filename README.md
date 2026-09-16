# HALSTRAL

**Private Business Orchestration Core**

HALSTRAL is an owner-controlled control plane for governing and coordinating bounded work across independent business workspaces without collapsing their data, credentials, or authority into a shared monolith.

> One Owner. One Orchestration Core. Many Independent Businesses. Separate Workspaces.

## Phase 2 status

Phase 2 — Task Orchestration & Execution Coordination is implemented. HALSTRAL now supports:

- task intake, classification, workspace resolution, and risk classification;
- active/registered/authorized capability selection with ownership checks;
- bounded, inspectable execution plans with dependencies, output expectations, approval, timeout, and retry controls;
- centralized default-deny policy evaluation at selection and immediately before execution;
- a capability adapter boundary with a safe internal adapter and no arbitrary code execution;
- task, plan, step, and run lifecycle management with rejected invalid transitions;
- HIGH/CRITICAL approval gates and explicit owner approval references;
- bounded retries for allow-listed transient failures only;
- per-step and overall task timeouts, cancellation, and failure classification;
- idempotency records that prevent duplicate side effects on repeated execution;
- workspace-bound result validation and persistence;
- append-only, secret-safe lifecycle audit events;
- 44 automated tests: 19 Phase 1 regression tests and 25 Phase 2 tests.

## Stack

- TypeScript
- Hono
- Cloudflare Pages/Workers
- Cloudflare D1 (SQLite)
- Vite
- Vitest

Architecture and operations: [`docs/10_PHASE_2_IMPLEMENTATION_GUIDE.md`](./docs/10_PHASE_2_IMPLEMENTATION_GUIDE.md).
Acceptance evidence: [`docs/11_PHASE_2_ACCEPTANCE_EVIDENCE.md`](./docs/11_PHASE_2_ACCEPTANCE_EVIDENCE.md).

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

Credential values are never domain data. Tasks may carry only scoped references shaped as `secret://workspace/<slug>/<credential>`.

## API entry URIs

Public:

- `GET /`
- `GET /health`

Protected registry routes:

- Workspaces: `/workspaces`, `/workspaces/:id`, `/workspaces/:id/suspend`, `/workspaces/:id/archive`
- Capabilities: `/capabilities`, `/capabilities/:id`, `/capabilities/:id/disable`
- Policies: `/policies`, `/policies/:id`
- Tasks: `/tasks`, `/tasks/:id`, `/tasks/:id/cancel`
- Runs: `/runs`, `/runs/:id`
- Audit: `/events`, `/events/:id`

Protected orchestration routes:

- `POST /tasks/:id/classify` — classify an accepted task
- `POST /tasks/:id/plans` — create a bounded execution plan
- `GET /plans` / `GET /plans/:id` — inspect plans
- `POST /plans/:id/approval` — submit `{ "decision": "GRANTED|DENIED", "approvalRef": "..." }`
- `POST /plans/:id/execute` — run an approved plan through controlled adapters
- `GET /results` / `GET /results/:id` — inspect workspace-bound results

All protected routes require `Authorization: Bearer <token>` and accept `X-Actor-Type`/`X-Actor-Id` for auditable owner-controlled delegation context.

## Execution model

```text
PENDING → CLASSIFIED → PLANNED → AUTHORIZED → DISPATCHED → RUNNING
                                                            ├─ COMPLETED
                                                            ├─ RETRYING
                                                            ├─ FAILED
                                                            ├─ BLOCKED
                                                            └─ CANCELLED
```

A policy denial becomes `BLOCKED` and is never automatically retried. HIGH and CRITICAL capabilities require explicit owner approval. Unknown adapters and unsafe retry/idempotency combinations fail closed.

## Data architecture

D1 tables:

- Phase 1: `users`, `workspaces`, `capabilities`, `policies`, `tasks`, `runs`, `events`
- Phase 2: `execution_plans`, `execution_results`, `idempotency_records`

Every task, plan, run, result, and idempotency record has explicit workspace context. Audit events are append-only through the repository port and protected by D1 update/delete triggers.

Migrations:

```bash
npm run db:migrate:local
npm run db:migrate:prod
```

## User guide

1. Create an ACTIVE workspace.
2. Register an ACTIVE capability whose name maps to an installed controlled adapter.
3. Create explicit execution policies for delegated workspace actors; absent policy is DENY.
4. Create a task, classify it, and create a bounded plan.
5. Inspect and approve HIGH/CRITICAL plans.
6. Execute the plan and inspect results, runs, and events.
7. Suspend a workspace or disable a capability to stop new protected execution.

## Quality gate

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

Expected current result: 2 test files, 44 tests passing.

## Deployment

- Platform: Cloudflare Pages + D1
- Production URL: `https://halstral.pages.dev`
- Repository: `https://github.com/Sparkmind-obp-off/Halstral`
- Production branch: `main`
- Deployment path: Cloudflare BYOK (`wrangler pages`)

Production deployment requires applying migration `0002_phase_2_orchestration.sql` before publishing the Phase 2 worker.

## Known limitations / not implemented

- Only deterministic internal adapters are installed in production Phase 2; external connectors require separate reviewed adapter contracts and secrets.
- No unrestricted agents, browser automation, financial transactions, arbitrary remote code execution, or global credentials.
- Cancellation is cooperative at adapter boundaries; adapters must honor `AbortSignal` for immediate interruption.
- D1 persistence and audit appends are separate operations rather than one multi-table transaction.
- Managed identity federation, rate limiting, pagination, and credential-resolution infrastructure remain future hardening work.

## Recommended next steps

1. Add reviewed external adapters one capability at a time with scoped secret resolution.
2. Add durable owner identity/approval authentication before delegated production operators expand.
3. Add scheduled recovery only through a separately designed Cloudflare-compatible mechanism.
4. Operate Phase 2 and review audit evidence before designing Phase 3 optimization or learning behavior.
