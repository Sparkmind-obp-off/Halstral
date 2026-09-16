# HALSTRAL

**Private Business Orchestration Core**

HALSTRAL is an owner-controlled control plane for governing bounded work across isolated business workspaces.

> Execute safely, observe clearly, fail predictably, recover deliberately.

## Phase 3 status

Phase 3 — Safety, Observability & Recovery is implemented on top of the Phase 0–2 control plane:

- deterministic failure classes: `TRANSIENT`, `VALIDATION`, `AUTHORIZATION`, `CREDENTIAL`, `EXTERNAL_SERVICE`, `TIMEOUT`, `CANCELLED`, `SYSTEM`, `UNKNOWN`, and `CRITICAL`;
- bounded retries with validated attempts/backoff/timeouts and policy re-evaluation before every attempt;
- explicit cooperative cancellation through `AbortSignal` at adapter boundaries;
- per-step and overall execution timeout enforcement;
- replay protection through workspace/task/capability/step idempotency keys;
- conservative handling of unknown side-effect outcomes through safe-stop, incident creation, and manual review;
- concurrency limits at core, workspace, capability, and task scope;
- safe-stop at step, run, task, capability, workspace, and core scope, with owner-only audited release;
- structured secret-safe telemetry with correlation, task, run, workspace, capability, actor, duration, status, error class, retries, and policy outcome;
- auditable incident and recovery records;
- owner operations API for active/retrying/blocked runs, incidents, safe-stops, recoveries, and health;
- security headers, authenticated private routes, bounded request rate limiting, parameterized D1 statements, and non-leaking error responses;
- 54 automated normal and adversarial tests, including all 44 Phase 1–2 regression tests.

No unrestricted agents, arbitrary code execution, cross-workspace pooling, financial automation, or autonomous replay of unknown side effects were introduced.

## Stack

- TypeScript + Hono
- Cloudflare Pages/Workers
- Cloudflare D1
- Vite + Vitest

## Quick start

```bash
npm install
cp .env.example .dev.vars
# Add CONTROL_PLANE_TOKEN=<strong-private-token> to .dev.vars
npm run db:migrate:local
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
```

`.dev.vars`, `.env*`, build output, local D1 state, logs, and archives are excluded from Git.

## Environment variables

- `CONTROL_PLANE_TOKEN` — required private API bearer token; provision in production with Cloudflare Pages secrets.
- `OWNER_ID` — optional owner identifier; defaults to `owner_halstral`.

Credential values are never domain data. Tasks may carry only references shaped as `secret://workspace/<slug>/<credential>`.

## API entry URIs

Public, non-sensitive:

- `GET /` — service identity and active phase
- `GET /health`
- `GET /api/health`

All other routes require:

```http
Authorization: Bearer <CONTROL_PLANE_TOKEN>
X-Actor-Type: OWNER | WORKSPACE
X-Actor-Id: <audited actor id>
```

Registry and orchestration:

- Workspaces: `GET|POST /workspaces`, `GET|PATCH /workspaces/:id`, `POST /workspaces/:id/suspend`, `POST /workspaces/:id/archive`
- Capabilities: `GET|POST /capabilities`, `GET|PATCH /capabilities/:id`, `POST /capabilities/:id/disable`
- Policies: `GET|POST /policies`, `GET|PATCH /policies/:id`
- Tasks: `GET|POST /tasks`, `GET|PATCH /tasks/:id`, `POST /tasks/:id/classify`, `POST /tasks/:id/plans`, `POST /tasks/:id/cancel`
- Plans: `GET /plans`, `GET /plans/:id`, `POST /plans/:id/approval`, `POST /plans/:id/execute`
- Results: `GET /results`, `GET /results/:id`
- Runs: `GET|POST /runs`, `GET|PATCH /runs/:id`, `POST /runs/:id/recover`
- Audit: `GET /events`, `GET /events/:id`

Owner safety controls:

- `GET /operations/overview` — active/retrying/blocked runs and aggregate health
- `GET /incidents`
- `POST /incidents/:id/resolve` with `{ "status": "MITIGATED|RESOLVED|CLOSED" }`
- `GET /safe-stops`
- `POST /safe-stops` with `{ "scope", "scopeId", "workspaceId?", "reason" }`
- `POST /safe-stops/:id/release`
- `GET /recoveries`
- `GET /telemetry`

## Execution and recovery model

```text
TASK → PLAN → POLICY GATE → EXECUTION → OBSERVE
                              ├→ SUCCESS → COMPLETE
                              ├→ TRANSIENT FAILURE → BOUNDED RETRY
                              ├→ TIMEOUT → CANCEL + INCIDENT/SAFE-STOP
                              ├→ POLICY/CREDENTIAL FAILURE → BLOCK
                              └→ CRITICAL/UNKNOWN → SAFE-STOP + INCIDENT
```

Every retry re-checks workspace state, capability state, safe-stop state, approval, and authorization. Retry exhaustion is terminal. A completed idempotent result is returned without repeating the side effect. An `IN_PROGRESS`/`UNKNOWN` replay is blocked for manual review.

## Data architecture

D1 tables:

- Phase 1: `users`, `workspaces`, `capabilities`, `policies`, `tasks`, `runs`, `events`
- Phase 2: `execution_plans`, `execution_results`, `idempotency_records`
- Phase 3: `incidents`, `safe_stops`, `recovery_records`, `telemetry`

Migration `0003_phase_3_safety_observability_recovery.sql` also upgrades idempotency records to support the conservative `UNKNOWN` state. Operational indexes cover workspace, run, timestamp, incident status, and active safe-stop queries. Repository list queries are bounded.

```bash
npm run db:migrate:local
npm run db:migrate:prod
```

## User guide

1. Create an active workspace, capability, and explicit execution policy.
2. Create and classify a task, then create a bounded plan.
3. Grant owner approval for HIGH/CRITICAL plans.
4. Execute and inspect `/results`, `/runs`, `/events`, and `/telemetry`.
5. Use `/operations/overview` for current operational health.
6. Trigger a safe-stop before investigation or risky maintenance.
7. Resolve incidents and release safe-stops only after evidence is reviewed.
8. Use `/runs/:id/recover`; completed idempotent outcomes return their recorded result, while uncertain outcomes remain blocked.

## Quality gate

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

Expected result: 3 test files and 54 tests passing before deployment.

## Deployment

- Platform: Cloudflare Pages + D1
- Production URL: `https://halstral.pages.dev`
- Repository: `https://github.com/Sparkmind-obp-off/Halstral`
- Production branch: `main`
- Deployment path: Cloudflare BYOK (`wrangler pages`)
- Current target migration: `0003_phase_3_safety_observability_recovery.sql`

Production procedure:

```bash
npm run build
npm run db:migrate:prod
npx wrangler pages deploy dist --project-name halstral
```

`CONTROL_PLANE_TOKEN` must remain a Cloudflare secret and must never be committed.

## Features not implemented / known limits

- Only deterministic internal adapters are installed; external connectors require separately reviewed contracts and scoped secret resolution.
- D1 persistence and event appends span multiple statements; Cloudflare D1 transaction/session hardening remains a future improvement.
- Rate limiting is isolate-local and defensive, not a globally strict quota. A durable D1 or purpose-built edge limiter is recommended before opening sensitive APIs broadly.
- Cancellation is cooperative; adapter implementations must honor `AbortSignal`.
- Recovery intentionally does not auto-replay unknown side effects.
- There is no browser-based owner dashboard; Phase 3 owner controls are authenticated JSON APIs.

## Recommended next steps

1. Operate Phase 3 and review incident/recovery evidence before any Phase 4 learning or optimization.
2. Add reviewed external adapters one capability at a time with verified idempotency semantics.
3. Add durable owner identity and short-lived scoped credentials instead of a shared bearer token.
4. Add atomic D1 persistence for related protected state transitions where platform semantics permit.
5. Build a read-only owner dashboard over the existing operations API if a visual console is required.

Last updated: 2026-09-16.
