# HALSTRAL

**Private Business Orchestration Core**

HALSTRAL is an owner-controlled control plane for governed execution and controlled learning across isolated business workspaces.

> Learn from verified outcomes, optimize deliberately, preserve control.

## Phase 4 status

Phase 4 — Learning & Optimization is implemented on top of the Phase 0–3 registry, orchestration, safety, observability, and recovery controls:

- structured, workspace-scoped outcome capture with immutable source provenance and configuration-version attribution;
- verified learning signals for success/failure, latency, retries, timeouts, recovery, and policy denials;
- explicit optimization proposals backed only by verified workspace-local evidence;
- owner review, approval references, application-time authorization/state/safety/current-version re-checks;
- versioned capability configuration revisions with recoverable prior state;
- deterministic baseline/post-change performance measurement and comparison;
- controlled revert and disable paths;
- capability promotion requiring ownership, provenance, performance, scope, security contract, approval, and Phase 3 safety checks;
- append-only Phase 4 audit events and recursive secret rejection/redaction;
- 65 automated tests: 54 Phase 0–3 regressions plus 11 Phase 4 tests.

Learning does not modify policies, ownership scope, risk classification, capability status, infrastructure, credentials, or executable code. Cross-workspace reuse remains denied unless a future explicit sharing contract is implemented.

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
npm run typecheck
npm test
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
```

## Environment

- `CONTROL_PLANE_TOKEN` — required private API bearer token; set as a Cloudflare Pages secret.
- `OWNER_ID` — optional owner identifier; defaults to `owner_halstral`.

Credentials are references only: `secret://workspace/<slug>/<credential>`. Raw secrets are rejected from domain, learning, telemetry, proposal, promotion, and audit payloads.

## API entry URIs

Public:

- `GET /`
- `GET /health`
- `GET /api/health`

All other routes require:

```http
Authorization: Bearer <CONTROL_PLANE_TOKEN>
X-Actor-Type: OWNER | WORKSPACE
X-Actor-Id: <audited actor id>
```

### Existing Phase 1–3 routes

- Workspaces: `GET|POST /workspaces`, `GET|PATCH /workspaces/:id`, `POST /workspaces/:id/suspend`, `POST /workspaces/:id/archive`
- Capabilities: `GET|POST /capabilities`, `GET|PATCH /capabilities/:id`, `POST /capabilities/:id/disable`
- Policies: `GET|POST /policies`, `GET|PATCH /policies/:id`
- Tasks: `GET|POST /tasks`, `GET|PATCH /tasks/:id`, `POST /tasks/:id/classify`, `POST /tasks/:id/plans`, `POST /tasks/:id/cancel`
- Plans: `GET /plans`, `GET /plans/:id`, `POST /plans/:id/approval`, `POST /plans/:id/execute`
- Runs/results/audit: `GET|POST /runs`, `GET /results`, `GET /events`, `POST /runs/:id/recover`
- Safety: `GET /operations/overview`, `GET|POST /safe-stops`, `GET /incidents`, `GET /recoveries`, `GET /telemetry`

### Phase 4 routes

- Outcomes: `GET /outcomes?workspaceId=...`, `POST /outcomes`
- Signals: `GET /learning-signals?workspaceId=...`, `POST /learning-signals/derive`
- Proposals: `GET|POST /optimization-proposals`, `POST /optimization-proposals/:id/submit`, `/decision`, `/apply`, `/revert`, `/disable`
- Revisions: `GET /configuration-revisions?workspaceId=...`
- Measurement: `POST /performance-measurements`, `GET /performance-comparison?workspaceId=...&targetId=...`
- Promotion: `GET|POST /capability-promotions`, `POST /capability-promotions/:id/decision`, `/promote`

Protected Phase 4 mutations are owner-only. Workspace actors can inspect only explicitly policy-authorized resources in their own scope.

## Data architecture

D1 tables:

- Phase 1: `users`, `workspaces`, `capabilities`, `policies`, `tasks`, `runs`, `events`
- Phase 2: `execution_plans`, `execution_results`, `idempotency_records`
- Phase 3: `incidents`, `safe_stops`, `recovery_records`, `telemetry`
- Phase 4: `outcome_records`, `learning_signals`, `optimization_proposals`, `configuration_revisions`, `performance_measurements`, `capability_promotions`

Apply migrations:

```bash
npm run db:migrate:local
npm run db:migrate:prod
```

## Controlled learning flow

```text
TERMINAL EXECUTION → VERIFIED OUTCOME → TRACEABLE SIGNAL
                                      → EXPLICIT PROPOSAL
                                      → OWNER REVIEW
                                      → APPLICATION-TIME RE-CHECK
                                      → VERSIONED APPLICATION
                                      → MEASURE / COMPARE
                                      → KEEP / REVERT / DISABLE
```

Unverified outcomes remain inspectable but cannot become trusted signals. Proposals cannot directly mutate active configuration. Application fails closed if workspace, capability, safe-stop, authorization, approval, or base revision has changed.

## Quality gate

```bash
npm run db:migrate:local
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

Current result: 4 test files, 65/65 tests passing; all 54 Phase 0–3 regression tests pass; local migrations 0001–0004 pass; production dependency audit reports zero vulnerabilities.

## Deployment

- Platform: Cloudflare Pages + D1
- Production project: `halstral`
- Production URL: `https://halstral.pages.dev`
- Repository: `https://github.com/Sparkmind-obp-off/Halstral`
- Branch: `main`
- Deployment path: Cloudflare BYOK (`wrangler pages`)
- Current migration: `0004_phase_4_learning_optimization.sql`

```bash
npm run build
npm run db:migrate:prod
npx wrangler pages deploy dist --project-name halstral
```

Never commit `CONTROL_PLANE_TOKEN` or other credentials.

## Known limitations / not implemented

- Phase 4 uses deterministic metrics and rules, not external ML/AI providers.
- Mutable optimization targets are currently capability descriptions and input/output schemas only; policy, risk, ownership, status, infrastructure, and executable code are intentionally immutable through learning.
- Workflow-target proposals are represented in the domain but rejected until a governed workflow registry exists.
- Capability promotion records approved reuse readiness; it does not automatically copy data, credentials, or capability ownership across workspaces.
- Outcome capture is explicit rather than automatically hooked to every terminal execution path.
- D1 protected multi-record transitions are multiple statements; stronger atomic transaction handling remains recommended.
- The bearer token is still the outer private control-plane boundary; durable scoped identities are a future hardening step.
- No browser owner dashboard is included; controls are authenticated JSON APIs.

## Recommended next steps

1. Operate Phase 4 with reviewed production outcomes before expanding scope.
2. Add atomic D1 transaction/session handling for proposal application and rollback.
3. Add an explicit cross-workspace sharing-contract domain before any shared promotion consumption.
4. Add durable owner/workspace identity and short-lived scoped credentials.
5. Automate outcome capture from terminal execution only after provenance and verification policy are finalized.

Last updated: 2026-09-16.
