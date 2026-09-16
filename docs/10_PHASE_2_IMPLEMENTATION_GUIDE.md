# HALSTRAL Phase 2 Implementation Guide

## Architecture decision

Phase 2 preserves the Phase 1 TypeScript/Hono/Cloudflare D1 stack and hexagonal boundary. The orchestration core is framework-independent and depends on repository and execution-adapter ports.

```text
Authenticated Hono API
        ↓
ControlPlane + OrchestrationEngine
        ├─ centralized policy evaluator (default DENY)
        ├─ state machine / planner / retry controller
        ├─ Repository port → D1 or memory adapter
        └─ AdapterRegistry → explicit ExecutionAdapter → bounded tool
```

No arbitrary module loading, shell execution, remote-code execution, global credential injection, or unrestricted connector exists.

## Domain components

- `TaskClassification`: task, workspace, task type, required capabilities, risk, constraints.
- `ExecutionPlan`: workspace-bound plan, status, overall timeout, ordered steps.
- `ExecutionStep`: capability, input, dependencies, approval, timeout, retry policy, expected output, attempts, status.
- `CapabilityInvocation`: approved capability/workspace/task/run/input, credential reference, and policy context. It never carries credential values.
- `ExecutionResult`: workspace-bound validated success/failure record.
- `IdempotencyRecord`: durable side-effect boundary keyed by workspace/plan/step.
- `OrchestrationEngine`: classifier, selector, planner, policy gate, dispatcher, runner, recovery controller, result handler, and lifecycle audit coordinator.
- `AdapterRegistry`: allow-listed mapping from registered capability name to adapter.
- `ExecutionAdapter`: explicit adapter contract with idempotency declaration and `AbortSignal`.

## State machines

Task:

```text
PENDING → CLASSIFIED → PLANNED → AUTHORIZED → DISPATCHED → RUNNING
                                                            ├─ RETRYING → RUNNING
                                                            ├─ COMPLETED
                                                            ├─ FAILED
                                                            ├─ BLOCKED
                                                            └─ CANCELLED
```

Legacy `DELEGATED` remains for Phase 1 compatibility. Invalid transitions continue to be rejected.

Plans move through `CREATED`/`AWAITING_APPROVAL`, `AUTHORIZED`, `RUNNING`, and a terminal state. Steps move through `PENDING`, `AUTHORIZED`, `DISPATCHED`, `RUNNING`, optional `RETRYING`, and a terminal state. Runs preserve Phase 1 states and add dispatch/retry/block context.

## Policy and approval

1. Capability selection verifies registration, ACTIVE status, and ownership scope.
2. The centralized policy evaluator runs during selection.
3. The same policy gate runs immediately before every adapter attempt.
4. No matching delegated policy is DENY; explicit DENY overrides ALLOW.
5. A denial blocks execution and is non-retryable.
6. Policy-required approval must have an approval reference.
7. HIGH and CRITICAL capability plans always wait for explicit owner approval.
8. Approval denials block the task and are auditable.

The owner retains charter-defined authority, but cannot silently bypass HIGH/CRITICAL approval plan inspection.

## Adapter contract

```ts
interface ExecutionAdapter {
  readonly id: string
  readonly capabilityNames: readonly string[]
  readonly supportsIdempotency: boolean
  execute(invocation: CapabilityInvocation, signal: AbortSignal): Promise<AdapterResult>
}
```

Adapters receive only approved inputs, a scoped credential reference, and policy context. Secret resolution belongs to a future reviewed credential provider; Phase 2 does not resolve secret values. The production `InternalExecutionAdapter` performs deterministic internal transformations only and does not access the network or runtime filesystem.

Adapters classify failures with `AdapterError`: `TRANSIENT`, `INVALID_INPUT`, `AUTHORIZATION`, `CREDENTIAL`, `EXTERNAL_REFUSAL`, `TIMEOUT`, or `UNSAFE_IDEMPOTENCY`.

## Retry, timeout, cancellation, and idempotency

- `maxAttempts`: 1–5.
- backoff: 0–30 seconds.
- step timeout: 1–300 seconds.
- overall plan timeout: 1–1800 seconds.
- only errors both marked retryable by the adapter and allow-listed by the plan retry.
- authorization and credential failures are blocked, never retried.
- cancellation is checked before each step/attempt and after adapter return.
- adapters receive `AbortSignal` for timeout cooperation.
- adapters declaring no idempotency support are blocked when a retrying plan could duplicate side effects.
- replay of a completed plan returns persisted results without another adapter invocation.

## Persistence and migration

Migration `0002_phase_2_orchestration.sql`:

- widens capability risk to include `CRITICAL`;
- widens task/run states;
- adds run attempt and idempotency metadata;
- adds `execution_plans`;
- adds `execution_results`;
- adds `idempotency_records` and indexes.

Apply locally:

```bash
npm run db:migrate:local
```

Apply production before deploying code:

```bash
npm run db:migrate:prod
```

## API

```text
POST /tasks/:id/classify
POST /tasks/:id/plans
GET  /plans
GET  /plans/:id
POST /plans/:id/approval
POST /plans/:id/execute
GET  /results
GET  /results/:id
```

All are protected by the existing bearer-token and actor-context middleware.

## Audit lifecycle

The existing append-only event repository records task acceptance/classification, plan creation, capability selection, policy decisions, approval events, dispatch, execution, failure/retry, result storage, completion/block/cancel, and existing run events. Metadata passes plaintext-secret rejection and recursive redaction.

## Verification

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

The Phase 2 matrix is in `tests/orchestration.test.ts`; Phase 1 regression remains in `tests/control-plane.test.ts`.

## Security limitations

- The private bearer token is still the outer control-plane trust boundary.
- Cancellation is cooperative for an adapter that ignores `AbortSignal`.
- D1 writes and event appends are not one multi-table transaction.
- External connector credentials and secret resolution are intentionally not implemented.
- External adapters require individual security review, output schemas, revocation behavior, and idempotency evidence.
