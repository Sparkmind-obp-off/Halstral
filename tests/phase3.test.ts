import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRepository } from '../src/adapters/memory-repository'
import { ControlPlane } from '../src/application/control-plane'
import { OrchestrationEngine } from '../src/application/orchestration-engine'
import { SafetyController } from '../src/application/safety-controller'
import type { Actor, CapabilityInvocation, Run } from '../src/domain/models'
import { AdapterError, AdapterRegistry, type AdapterResult, type ExecutionAdapter } from '../src/ports/execution-adapter'
import { createApp } from '../src/http/app'

const owner: Actor = { id: 'owner_halstral', type: 'OWNER' }
const workspaceActor: Actor = { id: 'ws_phase3', type: 'WORKSPACE' }

class ScriptedAdapter implements ExecutionAdapter {
  readonly id = 'test.phase3'
  readonly capabilityNames = ['internal.phase3'] as const
  calls = 0
  constructor(
    private readonly action: (call: number, invocation: CapabilityInvocation, signal: AbortSignal) => Promise<AdapterResult>,
    readonly supportsIdempotency = true,
  ) {}
  execute(invocation: CapabilityInvocation, signal: AbortSignal) { this.calls += 1; return this.action(this.calls, invocation, signal) }
}

let repo: MemoryRepository
let control: ControlPlane
let registry: AdapterRegistry
let engine: OrchestrationEngine

beforeEach(() => {
  repo = new MemoryRepository()
  control = new ControlPlane(repo)
  registry = new AdapterRegistry()
  engine = new OrchestrationEngine(repo, registry)
})

async function prepare(adapter: ExecutionAdapter, options: { retries?: number; timeout?: number; engineOverride?: OrchestrationEngine } = {}) {
  registry.register(adapter)
  engine = options.engineOverride ?? new OrchestrationEngine(repo, registry)
  await control.createWorkspace({ id: 'ws_phase3', slug: 'phase3', name: 'Phase 3', ownerId: owner.id, environment: 'test' }, owner)
  await control.createCapability({ id: 'cap_phase3', name: 'internal.phase3', ownerScope: 'WORKSPACE', workspaceId: 'ws_phase3', riskLevel: 'LOW', inputSchema: {}, outputSchema: {} }, owner)
  await control.createPolicy({ id: 'pol_execute', workspaceId: 'ws_phase3', name: 'Allow execution', subject: workspaceActor.id, resource: 'capability:cap_phase3', action: 'execute', scope: 'ws_phase3', effect: 'ALLOW' }, owner)
  const task = await control.createTask({ id: 'task_phase3', workspaceId: 'ws_phase3', title: 'Phase 3 test', capabilityId: 'cap_phase3' }, owner)
  await engine.classifyTask(task.id, { capabilityIds: ['cap_phase3'] }, workspaceActor)
  const plan = await engine.createPlan(task.id, {
    capabilityIds: ['cap_phase3'], input: { safe: true }, timeoutSeconds: options.timeout ?? 30,
    retryPolicy: { maxAttempts: options.retries ?? 1, backoffMs: 0 },
  }, workspaceActor)
  return { task, plan }
}

const runFixture = (overrides: Partial<Run> = {}): Run => ({
  id: 'run_active', taskId: 'another_task', workspaceId: 'ws_phase3', status: 'RUNNING', attempt: 1,
  idempotencyKey: 'ws_phase3:another_task:cap_phase3:step', startedAt: new Date().toISOString(), completedAt: null,
  error: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides,
})

describe('Phase 3 safety, observability, and recovery', () => {
  it('emits structured secret-safe telemetry with correlation context', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    const { plan } = await prepare(adapter)
    await engine.executePlan(plan.id, workspaceActor)
    const telemetry = await repo.listTelemetry()
    expect(telemetry.length).toBeGreaterThanOrEqual(3)
    expect(telemetry.every((record) => record.correlationId && record.workspaceId === 'ws_phase3')).toBe(true)
    expect(telemetry.some((record) => record.status === 'COMPLETED' && record.policyOutcome === 'ALLOW')).toBe(true)
    expect(JSON.stringify(telemetry)).not.toContain('plaintext-secret')
  })

  it('bounds retry and emits scheduling plus exhaustion events', async () => {
    const adapter = new ScriptedAdapter(async () => { throw new AdapterError('TRANSIENT', 'temporary', 'TRANSIENT', true) })
    const { plan } = await prepare(adapter, { retries: 2 })
    const outcome = await engine.executePlan(plan.id, workspaceActor)
    expect(outcome.plan.status).toBe('FAILED')
    expect(adapter.calls).toBe(2)
    const types = (await repo.listEvents()).map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['EXECUTION_RETRY_SCHEDULED', 'EXECUTION_RETRY_EXHAUSTED']))
  })

  it('records timeout, creates incident, and safe-stops uncertain replay', async () => {
    const adapter = new ScriptedAdapter(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); return { output: { late: true } } })
    const { plan } = await prepare(adapter, { timeout: 1 })
    expect((await engine.executePlan(plan.id, workspaceActor)).plan.status).toBe('FAILED')
    expect((await repo.listIncidents())[0]).toMatchObject({ severity: 'HIGH', category: 'TIMEOUT', status: 'OPEN' })
    expect((await repo.listSafeStops())[0]).toMatchObject({ scope: 'TASK', scopeId: 'task_phase3', active: true })
    expect((await repo.listEvents()).some((event) => event.type === 'EXECUTION_TIMEOUT')).toBe(true)
  })

  it('cooperatively cancels an active adapter and never completes it', async () => {
    let started!: () => void
    const ready = new Promise<void>((resolve) => { started = resolve })
    const adapter = new ScriptedAdapter(async (_call, _invocation, signal) => {
      started()
      await new Promise<void>((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Execution cancelled', 'AbortError')), { once: true }))
      return { output: { impossible: true } }
    })
    const { plan } = await prepare(adapter)
    const executing = engine.executePlan(plan.id, workspaceActor)
    await ready
    await engine.cancel('task_phase3', workspaceActor)
    expect((await executing).plan.status).toBe('CANCELLED')
    expect(await repo.listResults()).toHaveLength(0)
    expect((await repo.listEvents()).some((event) => event.type === 'EXECUTION_CANCELLED')).toBe(true)
  })

  it('enforces concurrency limits before dispatch and audits the block', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    const safety = new SafetyController(repo, owner.id, { core: 10, workspace: 1, capability: 1, task: 1 })
    const boundedEngine = new OrchestrationEngine(repo, registry, owner.id, safety)
    const { plan } = await prepare(adapter, { engineOverride: boundedEngine })
    await repo.createRun(runFixture())
    await expect(boundedEngine.executePlan(plan.id, workspaceActor)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(adapter.calls).toBe(0)
    expect((await repo.listEvents()).some((event) => event.type === 'CONCURRENCY_LIMIT_REACHED')).toBe(true)
  })

  it('blocks protected execution during safe-stop and audits owner-only release', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    const { plan } = await prepare(adapter)
    const safety = engine.getSafetyController()
    const stop = await safety.triggerSafeStop('WORKSPACE', 'ws_phase3', 'ws_phase3', 'operator hold', owner)
    await expect(engine.executePlan(plan.id, workspaceActor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(safety.releaseSafeStop(stop.id, workspaceActor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await safety.releaseSafeStop(stop.id, owner)
    expect((await engine.executePlan(plan.id, workspaceActor)).plan.status).toBe('COMPLETED')
    expect((await repo.listEvents()).some((event) => event.type === 'SAFE_STOP_RELEASED')).toBe(true)
  })

  it('returns a recorded idempotent result through explicit recovery', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    const { plan } = await prepare(adapter)
    const executed = await engine.executePlan(plan.id, workspaceActor)
    const run = (await repo.listRuns())[0]
    const recovered = await engine.recoverRun(run.id, owner)
    expect(recovered.recovery).toMatchObject({ status: 'COMPLETED', strategy: 'RETURN_RECORDED_RESULT' })
    expect(recovered.result?.id).toBe(executed.results[0].id)
    expect(adapter.calls).toBe(1)
  })

  it('fails closed on unknown failures with a critical incident and manual recovery', async () => {
    const adapter = new ScriptedAdapter(async () => { throw new Error('unclassified with secret-safe handling') })
    const { plan } = await prepare(adapter)
    expect((await engine.executePlan(plan.id, workspaceActor)).plan.status).toBe('BLOCKED')
    const run = (await repo.listRuns())[0]
    const recovered = await engine.recoverRun(run.id, owner)
    expect(recovered.recovery).toMatchObject({ status: 'BLOCKED', outcome: 'UNKNOWN', strategy: 'MANUAL_REVIEW' })
    expect((await repo.listIncidents()).some((incident) => incident.severity === 'CRITICAL' && incident.category === 'UNKNOWN')).toBe(true)
  })

  it('exposes owner operations while denying workspace inspection', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    await prepare(adapter)
    const app = createApp(control, 'phase3-token', owner.id, engine)
    const denied = await app.request('/operations/overview', { headers: { authorization: 'Bearer phase3-token', 'x-actor-type': 'WORKSPACE', 'x-actor-id': workspaceActor.id } })
    expect(denied.status).toBe(403)
    const allowed = await app.request('/operations/overview', { headers: { authorization: 'Bearer phase3-token', 'x-actor-type': 'OWNER', 'x-actor-id': owner.id } })
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toHaveProperty('health.core')
  })

  it('rejects secrets in incident metadata', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    await prepare(adapter)
    await expect(engine.getSafetyController().createIncident('HIGH', { correlationId: 'corr', workspaceId: 'ws_phase3', taskId: 'task_phase3' }, 'SYSTEM', 'safe summary', owner, { api_token: 'plaintext-secret' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(await repo.listIncidents()).toHaveLength(0)
  })
})
