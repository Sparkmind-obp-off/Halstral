# HALSTRAL Phase 2 Acceptance Evidence

## Scope

Evidence for Phase 2 — Task Orchestration & Execution Coordination while retaining Phase 0–1 isolation, policy, lifecycle, audit, and secret guarantees.

## Automated test mapping

`tests/orchestration.test.ts` contains 25 tests and explicitly maps the mandatory matrix:

1. task classification;
2. workspace resolution;
3. capability selection;
4. bounded/inspectable plan creation;
5. controlled dispatch;
6. successful execution;
7. result persistence;
8. task completion;
9. default-deny execution block;
10. unauthorized capability block;
11. suspended-workspace block;
12. archived-workspace intake rejection;
13. cross-workspace capability denial;
14. disabled capability block;
15. credential non-leakage;
16. bounded retryable recovery;
17. no retry for non-retryable failure;
18. no retry for authorization denial;
19. timeout transition;
20. cancellation;
21. idempotent replay;
22. complete lifecycle audit;
23. denied decision audit;
24. approval request/grant audit;
25. unsafe non-idempotent retry block.

`tests/control-plane.test.ts` retains all 19 Phase 1 regression tests.

## Reproducible commands

```bash
npm run db:migrate:local
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

## Current evidence

- Local D1 migrations `0001_phase_1.sql` and `0002_phase_2_orchestration.sql`: PASS.
- TypeScript strict typecheck: PASS.
- Phase 1 regression: 19/19 PASS.
- Phase 2 orchestration/security/recovery/audit: 25/25 PASS.
- Combined: 44/44 PASS.
- Build, coverage, dependency audit, production migration, deployment, and production health are recorded during final release verification.

## Security evidence

- Default authorization remains DENY.
- Explicit DENY takes precedence.
- Policy is evaluated during selection and immediately before each adapter attempt.
- Authorization failures are blocked and non-retryable.
- Workspace status is rechecked before execution.
- Capability registration, ACTIVE status, ownership, and adapter allow-list are checked.
- HIGH/CRITICAL capabilities require owner approval.
- Invocation carries credential references, never values.
- Audit/result persistence rejects or redacts plaintext-secret-shaped data.
- Idempotency keys and persisted records prevent replayed side effects.
- Unsafe retry of a non-idempotent adapter fails closed.
- No arbitrary code execution or unrestricted external connector is present.

## Gate

Phase 2 may be marked PASS only after the final quality gate, production migration, BYOK deployment, and production endpoint verification succeed. Otherwise the release report must state `PHASE 2 NOT READY` with the failing criterion.
