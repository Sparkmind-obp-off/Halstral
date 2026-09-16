import { beforeEach, describe, expect, it } from 'vitest'
import { InternalExecutionAdapter } from '../src/adapters/internal-execution-adapter'
import { MemoryRepository } from '../src/adapters/memory-repository'
import { ControlPlane } from '../src/application/control-plane'
import { OrchestrationEngine } from '../src/application/orchestration-engine'
import type { Actor, CapabilityInvocation } from '../src/domain/models'
import { AdapterError, AdapterRegistry, type AdapterResult, type ExecutionAdapter } from '../src/ports/execution-adapter'

const owner: Actor = { id: 'owner_halstral', type: 'OWNER' }
const merovia: Actor = { id: 'ws_merovia', type: 'WORKSPACE' }

let repo: MemoryRepository
let control: ControlPlane
let registry: AdapterRegistry
let engine: OrchestrationEngine

class ScriptedAdapter implements ExecutionAdapter {
  readonly id = 'test.scripted'
  readonly capabilityNames = ['internal.echo'] as const
  readonly supportsIdempotency: boolean
  calls = 0
  constructor(private readonly action: (call: number, invocation: CapabilityInvocation) => Promise<AdapterResult>, supportsIdempotency = true) { this.supportsIdempotency = supportsIdempotency }
  execute(invocation: CapabilityInvocation) { this.calls += 1; return this.action(this.calls, invocation) }
}

beforeEach(() => {
  repo = new MemoryRepository()
  control = new ControlPlane(repo)
  registry = new AdapterRegistry()
  registry.register(new InternalExecutionAdapter())
  engine = new OrchestrationEngine(repo, registry)
})

async function seedWorkspace(id = 'ws_merovia', slug = 'merovia') {
  return control.createWorkspace({ id, slug, name: slug, ownerId: owner.id, environment: 'test' }, owner)
}

async function seedCapability(riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW', workspaceId: string | null = 'ws_merovia', id = 'cap_echo') {
  return control.createCapability({ id, name: 'internal.echo', ownerScope: workspaceId ? 'WORKSPACE' : 'CORE', workspaceId: workspaceId ?? undefined, riskLevel, inputSchema: {}, outputSchema: {} }, owner)
}

async function allowExecution(actor = merovia, workspaceId = 'ws_merovia', capabilityId = 'cap_echo', approvalRequired = false) {
  return control.createPolicy({ id: `pol_${actor.id}_${capabilityId}_${Date.now()}`, workspaceId, name: 'Allow execution', subject: actor.id, resource: `capability:${capabilityId}`, action: 'execute', scope: workspaceId, effect: 'ALLOW', approvalRequired }, owner)
}

async function prepare(options: { actor?: Actor; risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; adapter?: ExecutionAdapter; credentialRef?: string; retries?: number; timeout?: number } = {}) {
  await seedWorkspace()
  await seedCapability(options.risk)
  if (options.adapter) { registry = new AdapterRegistry(); registry.register(options.adapter); engine = new OrchestrationEngine(repo, registry) }
  const actor = options.actor ?? owner
  if (actor.type === 'WORKSPACE') await allowExecution(actor)
  const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Bounded internal work', capabilityId: 'cap_echo', credentialRef: options.credentialRef }, owner)
  const classification = await engine.classifyTask(task.id, { taskType: 'internal.echo', capabilityIds: ['cap_echo'], constraints: { bounded: true } }, actor)
  const plan = await engine.createPlan(task.id, { capabilityIds: ['cap_echo'], input: { message: 'hello' }, retryPolicy: { maxAttempts: options.retries ?? 1, backoffMs: 0 }, timeoutSeconds: options.timeout ?? 30 }, actor)
  return { actor, task, classification, plan }
}

describe('Phase 2 orchestration happy path', () => {
  it('1. classifies a task with workspace, type, capability, risk, and constraints', async () => {
    const { classification } = await prepare()
    expect(classification).toMatchObject({ taskId: 'task_1', workspaceId: 'ws_merovia', taskType: 'internal.echo', requiredCapabilityIds: ['cap_echo'], riskLevel: 'LOW', constraints: { bounded: true } })
  })

  it('2. resolves and preserves the explicit workspace context', async () => {
    const { plan } = await prepare()
    expect(plan.workspaceId).toBe('ws_merovia')
    expect(plan.steps.every((step) => step.planId === plan.id)).toBe(true)
  })

  it('3. selects only the requested registered active capability', async () => {
    const { plan } = await prepare()
    expect(plan.steps.map((step) => step.capabilityId)).toEqual(['cap_echo'])
  })

  it('4. creates an inspectable bounded plan', async () => {
    const { plan } = await prepare({ retries: 2 })
    expect(plan.steps[0]).toMatchObject({ timeoutSeconds: 30, retryPolicy: { maxAttempts: 2 }, status: 'PENDING' })
    expect(await engine.getPlan(plan.id, owner)).toEqual(plan)
  })

  it('5. dispatches through the controlled adapter boundary', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { ok: true } }))
    const { plan } = await prepare({ adapter })
    await engine.executePlan(plan.id, owner)
    expect(adapter.calls).toBe(1)
    expect((await repo.listEvents()).some((event) => event.type === 'DISPATCH_STARTED')).toBe(true)
  })

  it('6. completes successful execution', async () => {
    const { plan } = await prepare()
    const executed = await engine.executePlan(plan.id, owner)
    expect(executed.plan.status).toBe('COMPLETED')
    expect(executed.plan.steps[0].status).toBe('COMPLETED')
  })

  it('7. validates and persists a workspace-bound result', async () => {
    const { plan } = await prepare()
    const { results } = await engine.executePlan(plan.id, owner)
    expect(results[0]).toMatchObject({ taskId: 'task_1', workspaceId: 'ws_merovia', status: 'SUCCEEDED' })
    expect(await engine.getResult(results[0].id, owner)).toEqual(results[0])
  })

  it('8. transitions the task to completed', async () => {
    const { plan } = await prepare()
    await engine.executePlan(plan.id, owner)
    expect((await repo.getTask('task_1'))?.status).toBe('COMPLETED')
  })
})

describe('Phase 2 security boundaries', () => {
  it('9. default-deny blocks execution selection', async () => {
    await seedWorkspace(); await seedCapability()
    await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Denied', capabilityId: 'cap_echo' }, owner)
    await expect(engine.classifyTask('task_1', { capabilityIds: ['cap_echo'] }, merovia)).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' })
  })

  it('10. blocks an unauthorized capability', async () => {
    await seedWorkspace(); await seedCapability()
    const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Denied' }, owner)
    await expect(engine.classifyTask(task.id, { capabilityIds: ['cap_echo'] }, merovia)).rejects.toBeTruthy()
    expect((await repo.getTask(task.id))?.status).toBe('PENDING')
  })

  it('11. prevents execution after workspace suspension', async () => {
    const { plan } = await prepare()
    await control.suspendWorkspace('ws_merovia', owner)
    await expect(engine.executePlan(plan.id, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await repo.listRuns()).length).toBe(0)
  })

  it('12. rejects task intake for an archived workspace', async () => {
    await seedWorkspace(); await control.archiveWorkspace('ws_merovia', owner)
    await expect(control.createTask({ workspaceId: 'ws_merovia', title: 'Archived work' }, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('13. denies cross-workspace capability access without explicit authorization', async () => {
    await seedWorkspace(); await seedWorkspace('ws_sparkmind', 'sparkmind'); await seedCapability('LOW', 'ws_sparkmind')
    const task = await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Cross boundary' }, owner)
    await expect(engine.classifyTask(task.id, { capabilityIds: ['cap_echo'] }, merovia)).rejects.toBeTruthy()
  })

  it('14. blocks a capability disabled after planning', async () => {
    const { plan } = await prepare()
    await control.disableCapability('cap_echo', owner)
    const result = await engine.executePlan(plan.id, owner)
    expect(result.plan.status).toBe('BLOCKED')
    expect((await repo.listRuns()).length).toBe(0)
  })

  it('15. never leaks credential values into audit or results', async () => {
    const adapter = new ScriptedAdapter(async (_call, invocation) => {
      expect(invocation.credentialRef).toBe('secret://workspace/merovia/github')
      return { output: { ok: true } }
    })
    const { plan } = await prepare({ adapter, credentialRef: 'secret://workspace/merovia/github' })
    await engine.executePlan(plan.id, owner)
    const persisted = JSON.stringify({ events: await repo.listEvents(), results: await repo.listResults() })
    expect(persisted).not.toContain('plaintext-production-token')
    expect(persisted).not.toContain('credentialRef')
  })
})

describe('Phase 2 failure, recovery, cancellation, and idempotency', () => {
  it('16. retries a retryable failure within maximum attempts', async () => {
    const adapter = new ScriptedAdapter(async (call) => {
      if (call === 1) throw new AdapterError('TRANSIENT', 'temporary outage', 'TRANSIENT', true)
      return { output: { recovered: true } }
    })
    const { plan } = await prepare({ adapter, retries: 2 })
    expect((await engine.executePlan(plan.id, owner)).plan.status).toBe('COMPLETED')
    expect(adapter.calls).toBe(2)
  })

  it('17. does not retry a non-retryable failure', async () => {
    const adapter = new ScriptedAdapter(async () => { throw new AdapterError('INVALID_INPUT', 'invalid', 'INVALID_INPUT', false) })
    const { plan } = await prepare({ adapter, retries: 3 })
    expect((await engine.executePlan(plan.id, owner)).plan.status).toBe('FAILED')
    expect(adapter.calls).toBe(1)
  })

  it('18. does not retry authorization denial', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { shouldNotRun: true } }))
    const { plan, actor } = await prepare({ actor: merovia, adapter, retries: 3 })
    await control.createPolicy({ workspaceId: 'ws_merovia', name: 'Deny execution now', subject: merovia.id, resource: 'capability:cap_echo', action: 'execute', scope: 'ws_merovia', effect: 'DENY' }, owner)
    const executed = await engine.executePlan(plan.id, actor)
    expect(executed.plan.status).toBe('BLOCKED')
    expect(adapter.calls).toBe(0)
  })

  it('19. transitions correctly on a non-retryable step timeout', async () => {
    const adapter = new ScriptedAdapter(async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); return { output: { late: true } } })
    const { plan } = await prepare({ adapter, timeout: 1 })
    const executed = await engine.executePlan(plan.id, owner)
    expect(executed.plan.status).toBe('FAILED')
    expect((await repo.listResults())[0].errorCode).toBe('TIMEOUT')
  })

  it('20. cancellation stops completion and further execution', async () => {
    let release!: () => void
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => { started = resolve })
    const adapter = new ScriptedAdapter(async () => { started(); await new Promise<void>((resolve) => { release = resolve }); return { output: { tooLate: true } } })
    const { plan } = await prepare({ adapter })
    const executing = engine.executePlan(plan.id, owner)
    await startedPromise
    await engine.cancel('task_1', owner)
    release()
    const outcome = await executing
    expect(outcome.plan.status).toBe('CANCELLED')
    expect(await repo.listResults()).toHaveLength(0)
  })

  it('21. idempotency prevents duplicate side effects', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { once: true } }))
    const { plan } = await prepare({ adapter })
    await engine.executePlan(plan.id, owner)
    await engine.executePlan(plan.id, owner)
    expect(adapter.calls).toBe(1)
    expect(await repo.listResults()).toHaveLength(1)
  })

  it('blocks retries for adapters that cannot guarantee idempotency', async () => {
    const adapter = new ScriptedAdapter(async () => ({ output: { unsafe: true } }), false)
    const { plan } = await prepare({ adapter, retries: 2 })
    expect((await engine.executePlan(plan.id, owner)).plan.status).toBe('BLOCKED')
    expect(adapter.calls).toBe(0)
  })
})

describe('Phase 2 audit and approval', () => {
  it('22. records the complete successful lifecycle', async () => {
    const { plan } = await prepare()
    await engine.executePlan(plan.id, owner)
    const types = (await repo.listEvents()).map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['TASK_ACCEPTED', 'TASK_CLASSIFIED', 'PLAN_CREATED', 'CAPABILITY_SELECTED', 'POLICY_EVALUATED', 'DISPATCH_STARTED', 'EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'RESULT_STORED', 'TASK_COMPLETED']))
  })

  it('23. records denied policy decisions', async () => {
    await seedWorkspace(); await seedCapability(); await control.createTask({ id: 'task_1', workspaceId: 'ws_merovia', title: 'Denied' }, owner)
    await expect(engine.classifyTask('task_1', { capabilityIds: ['cap_echo'] }, merovia)).rejects.toBeTruthy()
    expect((await repo.listEvents()).some((event) => event.type === 'POLICY_EVALUATED' && event.metadata.outcome === 'DENY')).toBe(true)
  })

  it('24. keeps high-risk plans inspectable and audits approval grant', async () => {
    const { plan } = await prepare({ risk: 'HIGH' })
    expect(plan.status).toBe('AWAITING_APPROVAL')
    await expect(engine.executePlan(plan.id, owner)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const approved = await engine.decideApproval(plan.id, true, 'approval_owner_001', owner)
    expect(approved.steps[0].approvalStatus).toBe('GRANTED')
    expect((await engine.executePlan(plan.id, owner)).plan.status).toBe('COMPLETED')
    const types = (await repo.listEvents()).map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['APPROVAL_REQUESTED', 'APPROVAL_GRANTED']))
  })
})
