# HALSTRAL Phase 3 Acceptance Evidence

Date: 2026-09-16

## Scope

This evidence maps the Phase 3 Safety, Observability & Recovery acceptance gate to implementation and automated verification.

## Acceptance gate

| Requirement | Evidence | Status |
|---|---|---|
| Structured observability | `TelemetryRecord`, `telemetry` D1 table, correlation-scoped emissions in `SafetyController` and `OrchestrationEngine` | PASS |
| Bounded retry | Retry policy clamps attempts to 1–5 and backoff to 0–30 seconds; `EXECUTION_RETRY_SCHEDULED` and `EXECUTION_RETRY_EXHAUSTED` | PASS |
| Timeout handling | Step timeout plus overall-plan deadline; cooperative abort; `EXECUTION_TIMEOUT`; unknown-outcome handling | PASS |
| Explicit cancellation | Task cancellation aborts active adapter controllers and emits task/run/execution cancellation events | PASS |
| Safe recovery | Owner-only recovery returns verified completed idempotent results and blocks unknown outcomes | PASS |
| Duplicate-side-effect protection | Workspace/task/capability/step idempotency keys; completed replay returns stored result; in-progress/unknown replay safe-stops | PASS |
| Concurrency limits | Core, workspace, capability, and task checks before run creation; limit event and blocked execution | PASS |
| Safe-stop controls | Six scopes, protected execution check, owner-only release, append-only events | PASS |
| Critical incident creation | Unknown and critical safety failures create workspace-scoped secret-safe incidents | PASS |
| Complete auditability | All Phase 3 protected transitions emit append-only events; telemetry and recovery are persisted | PASS |
| Phase 0–2 invariant preservation | All 44 pre-existing tests remain green | PASS |

## Automated evidence

Commands:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

Current functional suite:

- 19 Phase 1 control-plane tests;
- 25 Phase 2 orchestration and security tests;
- 10 Phase 3 normal/adversarial tests;
- total: 54 tests.

Phase 3 adversarial coverage includes:

1. secret-safe structured telemetry;
2. retry exhaustion;
3. timeout incident and safe-stop;
4. cooperative cancellation;
5. concurrency denial before dispatch;
6. safe-stop enforcement and owner-only release;
7. idempotent completed-result recovery;
8. unknown outcome fail-closed recovery;
9. owner-only operations inspection;
10. plaintext secret rejection in incident metadata.

## State and recovery guarantees

- terminal completed plans are returned without re-execution;
- cancelled execution cannot produce a stored success result;
- policy, workspace, capability, approval, and safe-stop state are re-checked before retry;
- retry exhaustion ends in terminal failure;
- unknown outcomes are never marked successful;
- unknown/critical outcomes trigger task-scoped safe-stop and incident creation;
- recovery cannot replay an unknown side effect automatically;
- safe-stop release requires the configured owner and produces an audit event.

## Operational controls

Authenticated owner routes:

- `GET /operations/overview`
- `GET /incidents`
- `POST /incidents/:id/resolve`
- `GET|POST /safe-stops`
- `POST /safe-stops/:id/release`
- `GET /recoveries`
- `GET /telemetry`
- `POST /runs/:id/recover`

## Decision

Phase 3 acceptance gate: **PASS**, subject to successful local D1 migration, production D1 migration, build, dependency audit, Cloudflare deployment, and post-deploy smoke verification recorded during release.

Phase 4 learning/optimization must not begin until production verification remains green and Phase 3 operational evidence has been reviewed.
