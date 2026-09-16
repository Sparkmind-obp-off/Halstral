# HALSTRAL Phase 1 Implementation Guide

## Stack decision

HALSTRAL uses **TypeScript, Hono, Cloudflare Pages/Workers, Cloudflare D1, Vite, and Vitest**.

Rationale:

- Hono keeps the HTTP layer small and Workers-compatible.
- D1 provides durable relational integrity and versioned SQLite migrations at the edge.
- Domain and authorization logic remain framework-independent behind a repository port.
- A memory repository makes security behavior deterministic in unit tests.
- Vitest provides a fast, reproducible acceptance suite.

This implementation intentionally contains no autonomous connector or external execution engine.

## Project structure

```text
src/
  adapters/       D1 and in-memory repository implementations
  application/    registry/control-plane use cases
  domain/         models, lifecycle rules, domain errors
  http/           authenticated Hono API
  policy/         centralized default-deny evaluator
  ports/          persistence interface
  security/       plaintext-secret rejection and redaction
  shared/         IDs and timestamps
migrations/       versioned D1 schema
public/           Cloudflare response security headers
tests/            Phase 1/security acceptance suite
```

## Setup

```bash
npm install
cp .env.example .dev.vars
# Replace/add CONTROL_PLANE_TOKEN with a strong local-only random value.
npm run db:migrate:local
npx wrangler d1 execute halstral-production --local --file=./seed.sql
npm run build
pm2 start ecosystem.config.cjs
```

`.dev.vars` is ignored by Git. Never commit it.

## Environment and secrets

| Variable | Required | Purpose |
|---|---:|---|
| `CONTROL_PLANE_TOKEN` | Yes | Private bearer token protecting every registry and audit route |
| `OWNER_ID` | No | Single owner authority identifier; defaults to `owner_halstral` |

Production values must be Cloudflare Pages secrets/environment variables. The API stores only scoped references such as `secret://workspace/merovia/github`, never credential values.

## Database

Local migration:

```bash
npm run db:migrate:local
npx wrangler d1 execute halstral-production --local --file=./seed.sql
```

Production migration after creating/binding the D1 database:

```bash
npx wrangler d1 migrations apply halstral-production --remote
```

The schema enforces foreign keys, lifecycle enum checks, capability ownership constraints, scoped credential-reference shape, and immutable audit events using `BEFORE UPDATE`/`BEFORE DELETE` triggers.

## Authentication and actor context

All protected routes require:

```http
Authorization: Bearer <CONTROL_PLANE_TOKEN>
X-Actor-Type: OWNER | WORKSPACE
X-Actor-Id: <actor-id>
```

`X-Actor-Type` defaults to `OWNER`, and owner identity must match `OWNER_ID`. The bearer token establishes the private control-plane trust boundary; actor headers provide auditable delegation context inside that boundary. A future identity provider is explicitly outside Phase 1.

## API

Public operational endpoints:

- `GET /` — phase identity, no secrets
- `GET /health` — health signal

Protected routes:

| Registry | Routes |
|---|---|
| Workspaces | `GET/POST /workspaces`, `GET/PATCH /workspaces/:id`, `POST /workspaces/:id/suspend`, `POST /workspaces/:id/archive` |
| Capabilities | `GET/POST /capabilities`, `GET/PATCH /capabilities/:id`, `POST /capabilities/:id/disable` |
| Policies | `GET/POST /policies`, `GET/PATCH /policies/:id` |
| Tasks | `GET/POST /tasks`, `GET/PATCH /tasks/:id`, `POST /tasks/:id/cancel` |
| Runs | `GET/POST /runs`, `GET/PATCH /runs/:id` |
| Events | `GET /events`, `GET /events/:id` |

Example:

```bash
curl -X POST https://<project>.pages.dev/workspaces \
  -H "Authorization: Bearer $CONTROL_PLANE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "id":"ws_merovia",
    "slug":"merovia",
    "name":"Merovia",
    "ownerId":"owner_halstral",
    "environment":"production"
  }'
```

Policy matching is exact for subject/resource/action/scope, with literal `*` supported as the global wildcard. Explicit `DENY` overrides `ALLOW`; no matching rule returns `DENY`. The owner retains charter-defined highest authority.

## Security assumptions

- Cloudflare terminates TLS; the application token is accepted only through the `Authorization` header.
- The bearer token holder is trusted to enter actor delegation context.
- Workspace actors receive no authority unless an owner-created active policy explicitly grants it.
- Policy creation/update and audit inspection are owner-only to prevent self-escalation.
- Archived workspaces reject tasks; non-active workspaces reject runs.
- Disabled capabilities cannot be selected for new tasks.
- Audit records are append-only through the repository port and immutable in D1.
- Error logs contain error names/messages only and never request payloads or authorization headers.

## Verification

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit
```

## Known limitations

- Phase 1 registers runs but does not execute external work.
- Owner approval references are not modeled yet; an `approvalRequired` allow policy fails closed.
- API pagination, rate limiting, managed identity federation, and key rotation automation remain future hardening work.
- Cross-resource persistence and audit append are separate D1 operations; event durability is systematic but not wrapped in a single transaction in this Pages adapter.
