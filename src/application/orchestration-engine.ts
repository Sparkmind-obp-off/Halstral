import { conflict, forbidden, invalid, notFound } from '../domain/errors'
import { canTransitionTask } from '../domain/lifecycle'
import type {
  Actor, AuditEvent, Capability, CapabilityInvocation, EventType, ExecutionPlan, ExecutionResult,
  ExecutionStep, FailureClass, RecoveryRecord, RetryPolicy, RiskLevel, Run, Task, TaskClassification,
} from '../domain/models'
import { evaluateAuthorization } from '../policy/evaluator'
import type { AdapterRegistry, ExecutionAdapter } from '../ports/execution-adapter'
import { AdapterError } from '../ports/execution-adapter'
import type { Repository } from '../ports/repository'
import { assertNoPlaintextSecrets, redactSecrets } from '../security/secrets'
import { newId, now } from '../shared/ids'
import { SafetyController, type ExecutionContext } from './safety-controller'

export type PlanInput = {
  capabilityIds?: string[]
  input?: Record<string, unknown>
  constraints?: Record<string, unknown>
  timeoutSeconds?: number
  overallTimeoutSeconds?: number
  retryPolicy?: Partial<RetryPolicy>
  expectedOutput?: Record<string, unknown>
}

type AttemptFailure = { code: string; message: string; errorClass: FailureClass; retryable: boolean; blocked: boolean; outcomeUnknown: boolean }

const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 1, backoffMs: 0, retryableErrors: ['TRANSIENT', 'TIMEOUT'], retryableClasses: ['TRANSIENT', 'EXTERNAL_SERVICE', 'TIMEOUT'] }
const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw invalid(`Value must be an integer between ${min} and ${max}`)
  return Number(value)
}
const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export class OrchestrationEngine {
  private readonly safety: SafetyController
  private readonly activeControllers = new Map<string, AbortController>()

  constructor(
    private readonly repo: Repository,
    private readonly adapters: AdapterRegistry,
    private readonly ownerId = 'owner_halstral',
    safety?: SafetyController,
  ) { this.safety = safety ?? new SafetyController(repo, ownerId) }

  private async audit(type: EventType, actor: Actor, workspaceId: string | null, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
    assertNoPlaintextSecrets(metadata)
    const event: AuditEvent = {
      id: newId('evt'), type, actor, workspaceId, resourceType, resourceId, timestamp: now(),
      metadata: redactSecrets(metadata) as Record<string, unknown>,
    }
    await this.repo.appendEvent(event)
  }

  private async policyGate(actor: Actor, workspaceId: string, capabilityId: string, approvalRef: string | null) {
    const resource = `capability:${capabilityId}`
    const decision = evaluateAuthorization({ actor, ownerId: this.ownerId, workspaceId, resource, action: 'execute', policies: await this.repo.listPolicies() })
    await this.audit('POLICY_EVALUATED', actor, workspaceId, 'capability', capabilityId, {
      action: 'execute', outcome: decision.effect, reason: decision.reason, policyId: decision.policyId,
      approvalRequired: decision.approvalRequired,
    })
    await this.audit(decision.effect === 'ALLOW' ? 'AUTHORIZATION_GRANTED' : 'AUTHORIZATION_DENIED', actor, workspaceId, 'authorization', resource, {
      action: 'execute', outcome: decision.effect, reason: decision.reason, policyId: decision.policyId,
    })
    if (decision.effect === 'DENY') throw new AdapterError('AUTHORIZATION_DENIED', `Authorization denied: ${decision.reason}`, 'AUTHORIZATION', false)
    if (decision.approvalRequired && !approvalRef) throw new AdapterError('APPROVAL_REQUIRED', 'Explicit approval is required', 'AUTHORIZATION', false)
    return decision
  }

  private async transitionTask(task: Task, status: Task['status']) {
    if (task.status === status) return
    if (!canTransitionTask(task.status, status)) throw conflict(`Invalid task transition: ${task.status} -> ${status}`)
    task.status = status
    task.updatedAt = now()
    await this.repo.saveTask(task)
  }

  private async requireTask(taskId: string, actor: Actor) {
    const task = await this.repo.getTask(taskId)
    if (!task) throw notFound('Task')
    if (actor.type === 'WORKSPACE' && actor.id !== task.workspaceId) {
      const decision = evaluateAuthorization({ actor, ownerId: this.ownerId, workspaceId: task.workspaceId, resource: `task:${taskId}`, action: 'orchestrate', policies: await this.repo.listPolicies() })
      await this.audit(decision.effect === 'ALLOW' ? 'AUTHORIZATION_GRANTED' : 'AUTHORIZATION_DENIED', actor, task.workspaceId, 'authorization', `task:${taskId}`, { action: 'orchestrate', outcome: decision.effect, reason: decision.reason })
      if (decision.effect === 'DENY') throw forbidden(`Authorization denied: ${decision.reason}`)
    }
    return task
  }

  private async requireExecutableWorkspace(workspaceId: string) {
    const workspace = await this.repo.getWorkspace(workspaceId)
    if (!workspace) throw notFound('Workspace')
    if (workspace.status !== 'ACTIVE') throw forbidden(`${workspace.status} workspace cannot execute actions`)
    return workspace
  }

  private async selectCapabilities(task: Task, requestedIds: string[], actor: Actor): Promise<Capability[]> {
    if (!requestedIds.length) throw invalid('At least one capability is required')
    const selected: Capability[] = []
    for (const id of requestedIds) {
      const capability = await this.repo.getCapability(id)
      if (!capability) throw notFound('Capability')
      if (capability.status !== 'ACTIVE') throw forbidden('Disabled or deprecated capability cannot execute')
      if (capability.ownerScope === 'WORKSPACE' && capability.workspaceId !== task.workspaceId) {
        const crossDecision = evaluateAuthorization({ actor, ownerId: this.ownerId, workspaceId: task.workspaceId, resource: `capability:${id}`, action: 'execute', policies: await this.repo.listPolicies() })
        if (crossDecision.effect !== 'ALLOW') throw forbidden('Cross-workspace capability access requires explicit authorization')
      }
      const decision = await this.policyGate(actor, task.workspaceId, id, null).catch((error) => {
        if (error instanceof AdapterError && error.code === 'APPROVAL_REQUIRED') return { effect: 'ALLOW' as const, reason: 'APPROVAL_PENDING', policyId: null, approvalRequired: true }
        throw error
      })
      await this.audit('CAPABILITY_SELECTED', actor, task.workspaceId, 'capability', id, { taskId: task.id, riskLevel: capability.riskLevel, approvalRequired: decision.approvalRequired })
      selected.push(capability)
    }
    return selected
  }

  async classifyTask(taskId: string, input: Pick<PlanInput, 'capabilityIds' | 'constraints'> & { taskType?: string }, actor: Actor): Promise<TaskClassification> {
    const task = await this.requireTask(taskId, actor)
    if (task.status !== 'PENDING') throw conflict('Only pending tasks can be classified')
    await this.requireExecutableWorkspace(task.workspaceId)
    const capabilityIds = input.capabilityIds?.length ? input.capabilityIds : task.capabilityId ? [task.capabilityId] : []
    const capabilities = await this.selectCapabilities(task, capabilityIds, actor)
    const riskOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    const riskLevel = capabilities.reduce<RiskLevel>((risk, capability) => riskOrder.indexOf(capability.riskLevel) > riskOrder.indexOf(risk) ? capability.riskLevel : risk, 'LOW')
    task.capabilityId = capabilityIds[0] ?? null
    await this.transitionTask(task, 'CLASSIFIED')
    const classification: TaskClassification = {
      taskId, workspaceId: task.workspaceId,
      taskType: input.taskType?.trim() || capabilities[0]?.name || 'bounded.internal',
      requiredCapabilityIds: capabilityIds,
      riskLevel,
      constraints: input.constraints ?? {},
    }
    assertNoPlaintextSecrets(classification)
    await this.audit('TASK_CLASSIFIED', actor, task.workspaceId, 'task', taskId, { taskType: classification.taskType, requiredCapabilityIds: capabilityIds, riskLevel })
    return classification
  }

  async createPlan(taskId: string, input: PlanInput, actor: Actor): Promise<ExecutionPlan> {
    const task = await this.requireTask(taskId, actor)
    if (task.status !== 'CLASSIFIED') throw conflict('Task must be classified before planning')
    await this.requireExecutableWorkspace(task.workspaceId)
    const capabilityIds = input.capabilityIds?.length ? input.capabilityIds : task.capabilityId ? [task.capabilityId] : []
    const capabilities = await this.selectCapabilities(task, capabilityIds, actor)
    assertNoPlaintextSecrets(input.input ?? {})
    const timestamp = now()
    const planId = newId('plan')
    const retryPolicy: RetryPolicy = {
      maxAttempts: clampInteger(input.retryPolicy?.maxAttempts, DEFAULT_RETRY.maxAttempts, 1, 5),
      backoffMs: clampInteger(input.retryPolicy?.backoffMs, DEFAULT_RETRY.backoffMs, 0, 30_000),
      retryableErrors: Array.isArray(input.retryPolicy?.retryableErrors) ? [...new Set(input.retryPolicy.retryableErrors.filter((value): value is string => typeof value === 'string'))].slice(0, 10) : [...DEFAULT_RETRY.retryableErrors],
      retryableClasses: [...DEFAULT_RETRY.retryableClasses!],
    }
    const steps: ExecutionStep[] = capabilities.map((capability, index) => {
      const approvalRequired = capability.riskLevel === 'HIGH' || capability.riskLevel === 'CRITICAL'
      return {
        id: newId('step'), planId, capabilityId: capability.id, input: input.input ?? {}, inputRef: null,
        dependsOn: index === 0 ? [] : [String(index - 1)], approvalRequired,
        approvalStatus: approvalRequired ? 'PENDING' : null, approvalRef: null,
        timeoutSeconds: clampInteger(input.timeoutSeconds, 30, 1, 300), retryPolicy,
        expectedOutput: input.expectedOutput ?? capability.outputSchema, status: 'PENDING', attempts: 0,
        createdAt: timestamp, updatedAt: timestamp,
      }
    })
    for (let index = 1; index < steps.length; index++) steps[index].dependsOn = [steps[index - 1].id]
    const requiresApproval = steps.some((step) => step.approvalRequired)
    const plan: ExecutionPlan = {
      id: planId, taskId, workspaceId: task.workspaceId, steps,
      status: requiresApproval ? 'AWAITING_APPROVAL' : 'CREATED',
      overallTimeoutSeconds: clampInteger(input.overallTimeoutSeconds, 300, 1, 1800),
      createdAt: timestamp, updatedAt: timestamp,
    }
    await this.repo.createPlan(plan)
    await this.transitionTask(task, 'PLANNED')
    await this.audit('PLAN_CREATED', actor, task.workspaceId, 'execution_plan', plan.id, { taskId, stepCount: steps.length, approvalRequired: requiresApproval })
    if (requiresApproval) await this.audit('APPROVAL_REQUESTED', actor, task.workspaceId, 'execution_plan', plan.id, { taskId, stepIds: steps.filter((step) => step.approvalRequired).map((step) => step.id) })
    return plan
  }

  async getPlan(id: string, actor: Actor) {
    const plan = await this.repo.getPlan(id)
    if (!plan) throw notFound('Execution plan')
    await this.requireTask(plan.taskId, actor)
    return plan
  }

  async listPlans(actor: Actor) {
    const plans = await this.repo.listPlans()
    if (actor.type === 'OWNER' && actor.id === this.ownerId) return plans
    const visible: ExecutionPlan[] = []
    for (const plan of plans) { try { await this.requireTask(plan.taskId, actor); visible.push(plan) } catch { /* default deny */ } }
    return visible
  }

  async decideApproval(planId: string, granted: boolean, approvalRef: string, actor: Actor) {
    if (actor.type !== 'OWNER' || actor.id !== this.ownerId) throw forbidden('Only the owner can decide approvals')
    if (!approvalRef.trim()) throw invalid('approvalRef is required')
    const plan = await this.repo.getPlan(planId)
    if (!plan) throw notFound('Execution plan')
    if (plan.status !== 'AWAITING_APPROVAL') throw conflict('Plan is not awaiting approval')
    for (const step of plan.steps.filter((value) => value.approvalRequired)) {
      step.approvalStatus = granted ? 'GRANTED' : 'DENIED'
      step.approvalRef = approvalRef
      step.updatedAt = now()
    }
    plan.status = granted ? 'CREATED' : 'BLOCKED'
    plan.updatedAt = now()
    await this.repo.savePlan(plan)
    await this.audit(granted ? 'APPROVAL_GRANTED' : 'APPROVAL_DENIED', actor, plan.workspaceId, 'execution_plan', plan.id, { approvalRef, outcome: granted ? 'GRANTED' : 'DENIED' })
    if (!granted) {
      const task = await this.repo.getTask(plan.taskId)
      if (task) { await this.transitionTask(task, 'BLOCKED'); await this.audit('TASK_BLOCKED', actor, plan.workspaceId, 'task', task.id, { reason: 'APPROVAL_DENIED' }) }
    }
    return plan
  }

  private classifyFailure(error: unknown, policy: RetryPolicy): AttemptFailure {
    const classified = this.safety.classify(error)
    const retryable = classified.retryable && (policy.retryableErrors.includes(classified.code) || policy.retryableClasses?.includes(classified.errorClass) === true)
    return {
      ...classified,
      retryable,
      blocked: ['AUTHORIZATION', 'CREDENTIAL', 'CRITICAL', 'UNKNOWN'].includes(classified.errorClass),
    }
  }

  private async invokeWithTimeout(adapter: ExecutionAdapter, invocation: CapabilityInvocation, timeoutSeconds: number) {
    const controller = new AbortController()
    this.activeControllers.set(invocation.runId, controller)
    const timer = setTimeout(() => controller.abort('TIMEOUT'), timeoutSeconds * 1000)
    try {
      return await Promise.race([
        adapter.execute(invocation, controller.signal),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new DOMException(controller.signal.reason === 'CANCELLED' ? 'Execution cancelled' : 'Execution timed out', 'AbortError')), { once: true })),
      ])
    } finally { clearTimeout(timer); this.activeControllers.delete(invocation.runId) }
  }

  async executePlan(planId: string, actor: Actor): Promise<{ plan: ExecutionPlan; results: ExecutionResult[] }> {
    const plan = await this.repo.getPlan(planId)
    if (!plan) throw notFound('Execution plan')
    const task = await this.requireTask(plan.taskId, actor)
    const correlationId = newId('corr')
    const baseContext: ExecutionContext = { correlationId, workspaceId: plan.workspaceId, taskId: task.id }
    if (plan.status === 'COMPLETED') return { plan, results: (await this.repo.listResults()).filter((result) => result.taskId === task.id) }
    if (plan.status === 'AWAITING_APPROVAL' || plan.steps.some((step) => step.approvalRequired && step.approvalStatus !== 'GRANTED')) throw forbidden('Plan requires explicit approval before execution')
    if (!['CREATED', 'AUTHORIZED'].includes(plan.status)) throw conflict(`Plan cannot execute from ${plan.status}`)
    await this.requireExecutableWorkspace(plan.workspaceId)

    await this.transitionTask(task, 'AUTHORIZED')
    plan.status = 'AUTHORIZED'; plan.updatedAt = now(); await this.repo.savePlan(plan)
    const orchestrationStarted = Date.now()
    const results: ExecutionResult[] = []

    for (const step of plan.steps) {
      const currentTask = await this.repo.getTask(task.id)
      if (!currentTask || currentTask.status === 'CANCELLED') { plan.status = 'CANCELLED'; step.status = 'CANCELLED'; await this.repo.savePlan(plan); return { plan, results } }
      if (Date.now() - orchestrationStarted >= plan.overallTimeoutSeconds * 1000) {
        const failure: AttemptFailure = { code: 'TASK_TIMEOUT', message: 'Overall task timeout exceeded', errorClass: 'TIMEOUT', retryable: false, blocked: true, outcomeUnknown: false }
        await this.safety.audit('EXECUTION_TIMEOUT', actor, { ...baseContext, stepId: step.id }, 'execution_plan', plan.id, { timeoutScope: 'TASK', timeoutSeconds: plan.overallTimeoutSeconds })
        await this.failStep(plan, task, step, actor, failure)
        return { plan, results }
      }
      if (step.dependsOn.some((id) => plan.steps.find((candidate) => candidate.id === id)?.status !== 'COMPLETED')) throw conflict('Step dependencies are not complete')
      const stepContext: ExecutionContext = { ...baseContext, capabilityId: step.capabilityId, stepId: step.id }
      await this.safety.assertNoSafeStop(stepContext)
      await this.safety.assertConcurrency(actor, stepContext)
      const capability = await this.repo.getCapability(step.capabilityId)
      if (!capability || capability.status !== 'ACTIVE') {
        await this.failStep(plan, task, step, actor, { code: 'CAPABILITY_UNAVAILABLE', message: 'Capability is not active', errorClass: 'AUTHORIZATION', retryable: false, blocked: true, outcomeUnknown: false })
        return { plan, results }
      }
      const adapter = this.adapters.resolve(capability.name)
      if (!adapter) {
        await this.failStep(plan, task, step, actor, { code: 'ADAPTER_UNAVAILABLE', message: 'No controlled adapter is registered', errorClass: 'SYSTEM', retryable: false, blocked: true, outcomeUnknown: false })
        return { plan, results }
      }
      if (!adapter.supportsIdempotency && step.retryPolicy.maxAttempts > 1) {
        const failure: AttemptFailure = { code: 'UNSAFE_IDEMPOTENCY', message: 'Adapter cannot safely retry side effects', errorClass: 'CRITICAL', retryable: false, blocked: true, outcomeUnknown: false }
        await this.safety.triggerSafeStop('TASK', task.id, task.workspaceId, failure.message, actor, correlationId)
        await this.safety.createIncident('CRITICAL', stepContext, 'CRITICAL', failure.message, actor, { capabilityId: capability.id })
        await this.failStep(plan, task, step, actor, failure)
        return { plan, results }
      }

      const runId = newId('run')
      const idempotencyKey = `${plan.workspaceId}:${task.id}:${capability.id}:${step.id}`
      const existingIdempotency = await this.repo.getIdempotencyRecord(idempotencyKey)
      if (existingIdempotency?.status === 'COMPLETED' && existingIdempotency.resultId) {
        const storedResult = await this.repo.getResult(existingIdempotency.resultId)
        if (!storedResult) throw conflict('Completed idempotency record has no result')
        step.status = 'COMPLETED'; step.updatedAt = now(); await this.repo.savePlan(plan); results.push(storedResult)
        await this.safety.telemetry(actor, stepContext, 'IDEMPOTENT_REPLAY', { policyOutcome: 'ALLOW', metadata: { resultId: storedResult.id } })
        continue
      }
      if (existingIdempotency?.status === 'IN_PROGRESS' || existingIdempotency?.status === 'UNKNOWN') {
        await this.safety.triggerSafeStop('TASK', task.id, task.workspaceId, 'Unknown prior side-effect outcome', actor, correlationId)
        await this.safety.createIncident('CRITICAL', stepContext, 'UNKNOWN', 'Execution outcome requires manual review before replay', actor, { idempotencyKey })
        await this.failStep(plan, task, step, actor, { code: 'UNKNOWN_SIDE_EFFECT_OUTCOME', message: 'Previous side-effect outcome is unknown', errorClass: 'UNKNOWN', retryable: false, blocked: true, outcomeUnknown: true })
        return { plan, results }
      }
      const timestamp = now()
      const run: Run = { id: runId, taskId: task.id, workspaceId: task.workspaceId, status: 'CREATED', attempt: 0, idempotencyKey, startedAt: null, completedAt: null, error: null, createdAt: timestamp, updatedAt: timestamp }
      await this.repo.createRun(run)
      const runContext: ExecutionContext = { ...stepContext, runId }
      await this.audit('RUN_CREATED', actor, task.workspaceId, 'run', run.id, { correlationId, taskId: task.id, stepId: step.id, capabilityId: capability.id })
      await this.safety.telemetry(actor, runContext, 'CREATED', { metadata: { planId: plan.id, stepId: step.id } })
      await this.repo.createIdempotencyRecord({ key: idempotencyKey, workspaceId: task.workspaceId, capabilityId: capability.id, status: 'IN_PROGRESS', resultId: null, createdAt: timestamp, updatedAt: timestamp })

      step.status = 'DISPATCHED'; step.updatedAt = now(); run.status = 'DISPATCHED'; run.updatedAt = step.updatedAt
      await this.repo.saveRun(run); plan.status = 'RUNNING'; await this.repo.savePlan(plan)
      await this.transitionTask(task, 'DISPATCHED'); await this.audit('DISPATCH_STARTED', actor, task.workspaceId, 'execution_step', step.id, { planId: plan.id, runId })
      await this.transitionTask(task, 'RUNNING')

      let completed = false
      for (let attempt = 1; attempt <= step.retryPolicy.maxAttempts; attempt++) {
        const refreshedTask = await this.repo.getTask(task.id)
        if (!refreshedTask || refreshedTask.status === 'CANCELLED') {
          run.status = 'CANCELLED'; step.status = 'CANCELLED'; plan.status = 'CANCELLED'; run.completedAt = now(); run.updatedAt = run.completedAt
          await this.repo.saveRun(run); await this.repo.savePlan(plan)
          await this.safety.audit('EXECUTION_CANCELLED', actor, runContext, 'run', run.id, { attempt, reason: 'TASK_CANCELLED' })
          await this.safety.telemetry(actor, runContext, 'CANCELLED', { errorClass: 'CANCELLED', retryCount: Math.max(0, attempt - 1) })
          return { plan, results }
        }
        step.attempts = attempt; step.status = 'RUNNING'; step.updatedAt = now(); run.attempt = attempt; run.status = 'RUNNING'; run.startedAt ??= step.updatedAt; run.updatedAt = step.updatedAt
        await this.repo.saveRun(run); await this.repo.savePlan(plan)
        try {
          await this.requireExecutableWorkspace(task.workspaceId)
          const currentCapability = await this.repo.getCapability(capability.id)
          if (!currentCapability || currentCapability.status !== 'ACTIVE') throw new AdapterError('CAPABILITY_UNAVAILABLE', 'Capability is no longer active', 'AUTHORIZATION', false)
          if (step.approvalRequired && step.approvalStatus !== 'GRANTED') throw new AdapterError('APPROVAL_REQUIRED', 'Approval is no longer valid', 'AUTHORIZATION', false)
          await this.safety.assertNoSafeStop(runContext)
          const decision = await this.policyGate(actor, task.workspaceId, capability.id, step.approvalRef)
          const invocation: CapabilityInvocation = {
            capabilityId: capability.id, workspaceId: task.workspaceId, taskId: task.id, runId,
            input: step.input, credentialRef: task.credentialRef,
            policyContext: { actor, policyId: decision.policyId, approvalRef: step.approvalRef, idempotencyKey },
          }
          const attemptStarted = Date.now()
          await this.audit('EXECUTION_STARTED', actor, task.workspaceId, 'run', runId, { correlationId, planId: plan.id, stepId: step.id, capabilityId: capability.id, attempt, adapterId: adapter.id })
          await this.safety.telemetry(actor, runContext, 'RUNNING', { retryCount: attempt - 1, policyOutcome: 'ALLOW', metadata: { attempt, adapterId: adapter.id } })
          const remainingOverallMs = Math.max(1, plan.overallTimeoutSeconds * 1000 - (Date.now() - orchestrationStarted))
          const effectiveTimeoutSeconds = Math.max(0.001, Math.min(step.timeoutSeconds, remainingOverallMs / 1000))
          const adapterResult = await this.invokeWithTimeout(adapter, invocation, effectiveTimeoutSeconds)
          const latestTask = await this.repo.getTask(task.id)
          if (latestTask?.status === 'CANCELLED') { run.status = 'CANCELLED'; step.status = 'CANCELLED'; plan.status = 'CANCELLED'; run.completedAt = now(); await this.repo.saveRun(run); await this.repo.savePlan(plan); return { plan, results } }
          assertNoPlaintextSecrets(adapterResult.output)
          const required = Array.isArray(step.expectedOutput.required) ? step.expectedOutput.required : []
          if (required.some((key) => typeof key === 'string' && !(key in adapterResult.output))) throw new AdapterError('INVALID_RESULT', 'Adapter result does not match expected output', 'INVALID_INPUT', false)
          const result: ExecutionResult = { id: newId('result'), taskId: task.id, runId, workspaceId: task.workspaceId, stepId: step.id, status: 'SUCCEEDED', output: redactSecrets(adapterResult.output) as Record<string, unknown>, errorCode: null, errorMessage: null, createdAt: now() }
          await this.repo.createResult(result); results.push(result)
          const idem = await this.repo.getIdempotencyRecord(idempotencyKey); if (idem) { idem.status = 'COMPLETED'; idem.resultId = result.id; idem.updatedAt = now(); await this.repo.saveIdempotencyRecord(idem) }
          step.status = 'COMPLETED'; step.updatedAt = now(); run.status = 'COMPLETED'; run.completedAt = step.updatedAt; run.updatedAt = step.updatedAt
          await this.repo.saveRun(run); await this.repo.savePlan(plan)
          await this.audit('EXECUTION_COMPLETED', actor, task.workspaceId, 'run', runId, { correlationId, planId: plan.id, stepId: step.id, capabilityId: capability.id, attempt })
          await this.safety.telemetry(actor, runContext, 'COMPLETED', { durationMs: Date.now() - attemptStarted, retryCount: attempt - 1, policyOutcome: 'ALLOW' })
          await this.audit('RESULT_STORED', actor, task.workspaceId, 'execution_result', result.id, { taskId: task.id, runId, stepId: step.id, status: result.status })
          completed = true
          break
        } catch (error) {
          const failure = this.classifyFailure(error, step.retryPolicy)
          await this.audit('EXECUTION_FAILED', actor, task.workspaceId, 'run', runId, { correlationId, planId: plan.id, stepId: step.id, capabilityId: capability.id, attempt, errorCode: failure.code, errorClass: failure.errorClass, retryable: failure.retryable })
          await this.safety.telemetry(actor, runContext, failure.errorClass === 'CANCELLED' ? 'CANCELLED' : 'FAILED', { errorClass: failure.errorClass, retryCount: attempt - 1, policyOutcome: failure.errorClass === 'AUTHORIZATION' ? 'DENY' : 'NOT_EVALUATED', metadata: { errorCode: failure.code, attempt } })
          if (failure.errorClass === 'TIMEOUT') await this.safety.audit('EXECUTION_TIMEOUT', actor, runContext, 'run', runId, { timeoutScope: 'STEP', timeoutSeconds: step.timeoutSeconds, attempt })
          if (failure.errorClass === 'CANCELLED') {
            run.status = 'CANCELLED'; step.status = 'CANCELLED'; plan.status = 'CANCELLED'; task.status = 'CANCELLED'; run.completedAt = now(); run.updatedAt = run.completedAt
            await this.repo.saveRun(run); await this.repo.savePlan(plan); await this.repo.saveTask(task)
            await this.safety.audit('EXECUTION_CANCELLED', actor, runContext, 'run', runId, { attempt })
            return { plan, results }
          }
          if (failure.retryable && attempt < step.retryPolicy.maxAttempts) {
            step.status = 'RETRYING'; run.status = 'RETRYING'; task.status = 'RETRYING'; task.updatedAt = now(); await this.repo.saveTask(task); await this.repo.saveRun(run); await this.repo.savePlan(plan)
            await this.audit('RETRY_SCHEDULED', actor, task.workspaceId, 'execution_step', step.id, { correlationId, runId, attempt, nextAttempt: attempt + 1, backoffMs: step.retryPolicy.backoffMs })
            await this.safety.audit('EXECUTION_RETRY_SCHEDULED', actor, runContext, 'execution_step', step.id, { attempt, nextAttempt: attempt + 1, backoffMs: step.retryPolicy.backoffMs, errorClass: failure.errorClass })
            if (step.retryPolicy.backoffMs) await sleep(step.retryPolicy.backoffMs)
            task.status = 'RUNNING'; task.updatedAt = now(); await this.repo.saveTask(task)
            continue
          }
          if (failure.retryable && attempt >= step.retryPolicy.maxAttempts) await this.safety.audit('EXECUTION_RETRY_EXHAUSTED', actor, runContext, 'execution_step', step.id, { attempts: attempt, errorClass: failure.errorClass, errorCode: failure.code })
          if (failure.outcomeUnknown) {
            const idem = await this.repo.getIdempotencyRecord(idempotencyKey); if (idem) { idem.status = 'UNKNOWN'; idem.updatedAt = now(); await this.repo.saveIdempotencyRecord(idem) }
            await this.safety.triggerSafeStop('TASK', task.id, task.workspaceId, 'Unknown side-effect outcome', actor, correlationId)
            await this.safety.createIncident(failure.errorClass === 'CRITICAL' || failure.errorClass === 'UNKNOWN' ? 'CRITICAL' : 'HIGH', runContext, failure.errorClass, 'Execution stopped because the side-effect outcome is unknown', actor, { errorCode: failure.code, attempt })
            if (failure.errorClass === 'CRITICAL' || failure.errorClass === 'UNKNOWN') failure.blocked = true
          }
          await this.failStep(plan, task, step, actor, failure, run)
          return { plan, results }
        }
      }
      if (!completed) return { plan, results }
    }

    plan.status = 'COMPLETED'; plan.updatedAt = now(); await this.repo.savePlan(plan)
    await this.transitionTask(task, 'COMPLETED')
    await this.audit('TASK_COMPLETED', actor, task.workspaceId, 'task', task.id, { correlationId, planId: plan.id, resultCount: results.length })
    await this.safety.telemetry(actor, baseContext, 'COMPLETED', { durationMs: Date.now() - orchestrationStarted, policyOutcome: 'ALLOW', metadata: { planId: plan.id, resultCount: results.length } })
    return { plan, results }
  }

  private async failStep(plan: ExecutionPlan, task: Task, step: ExecutionStep, actor: Actor, failure: AttemptFailure, run?: Run) {
    const timestamp = now()
    step.status = failure.blocked ? 'BLOCKED' : 'FAILED'; step.updatedAt = timestamp
    plan.status = failure.blocked ? 'BLOCKED' : 'FAILED'; plan.updatedAt = timestamp
    task.status = failure.blocked ? 'BLOCKED' : 'FAILED'; task.updatedAt = timestamp
    if (run) {
      run.status = failure.blocked ? 'BLOCKED' : 'FAILED'; run.error = failure.message; run.completedAt = timestamp; run.updatedAt = timestamp; await this.repo.saveRun(run)
      if (run.idempotencyKey && !failure.outcomeUnknown) { const idem = await this.repo.getIdempotencyRecord(run.idempotencyKey); if (idem) { idem.status = 'FAILED'; idem.updatedAt = timestamp; await this.repo.saveIdempotencyRecord(idem) } }
    }
    await this.repo.savePlan(plan); await this.repo.saveTask(task)
    const result: ExecutionResult | null = run ? { id: newId('result'), taskId: task.id, runId: run.id, workspaceId: task.workspaceId, stepId: step.id, status: 'FAILED', output: null, errorCode: failure.code, errorMessage: failure.message, createdAt: timestamp } : null
    if (result) { await this.repo.createResult(result); await this.audit('RESULT_STORED', actor, task.workspaceId, 'execution_result', result.id, { taskId: task.id, runId: result.runId, stepId: step.id, status: 'FAILED', errorCode: failure.code }) }
    if (failure.blocked) await this.audit('TASK_BLOCKED', actor, task.workspaceId, 'task', task.id, { planId: plan.id, reason: failure.code })
  }

  async cancel(taskId: string, actor: Actor) {
    const task = await this.requireTask(taskId, actor)
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) throw conflict('Terminal task cannot be cancelled')
    task.status = 'CANCELLED'; task.updatedAt = now(); await this.repo.saveTask(task)
    const plan = await this.repo.getPlanByTask(taskId)
    if (plan && !['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'].includes(plan.status)) { plan.status = 'CANCELLED'; plan.updatedAt = now(); for (const step of plan.steps.filter((value) => value.status !== 'COMPLETED')) step.status = 'CANCELLED'; await this.repo.savePlan(plan) }
    const correlationId = newId('corr')
    const runs = (await this.repo.listRuns()).filter((run) => run.taskId === taskId && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status))
    for (const run of runs) {
      this.activeControllers.get(run.id)?.abort('CANCELLED')
      run.status = 'CANCELLED'; run.completedAt = now(); run.updatedAt = run.completedAt; await this.repo.saveRun(run)
      await this.audit('RUN_CANCELLED', actor, task.workspaceId, 'run', run.id, { correlationId, taskId })
      await this.safety.audit('EXECUTION_CANCELLED', actor, { correlationId, workspaceId: task.workspaceId, taskId, runId: run.id }, 'run', run.id, { reason: 'EXPLICIT_CANCELLATION' })
    }
    await this.audit('TASK_CANCELLED', actor, task.workspaceId, 'task', task.id, { correlationId, planId: plan?.id ?? null })
    return task
  }

  async recoverRun(runId: string, actor: Actor) {
    if (actor.type !== 'OWNER' || actor.id !== this.ownerId) throw forbidden('Only the owner may recover executions')
    const run = await this.repo.getRun(runId)
    if (!run) throw notFound('Run')
    const correlationId = newId('corr')
    const context: ExecutionContext = { correlationId, workspaceId: run.workspaceId, taskId: run.taskId, runId }
    const result = (await this.repo.listResults()).find((value) => value.runId === runId && value.status === 'SUCCEEDED')
    const idem = run.idempotencyKey ? await this.repo.getIdempotencyRecord(run.idempotencyKey) : null
    const recovery: RecoveryRecord = {
      id: newId('recovery'), workspaceId: run.workspaceId, taskId: run.taskId, runId,
      outcome: run.status === 'COMPLETED' ? 'COMPLETED' : run.status === 'CANCELLED' ? 'CANCELLED' : idem?.status === 'UNKNOWN' || idem?.status === 'IN_PROGRESS' ? 'UNKNOWN' : 'KNOWN_FAILURE',
      status: 'STARTED', strategy: result && idem?.status === 'COMPLETED' ? 'RETURN_RECORDED_RESULT' : 'MANUAL_REVIEW',
      createdAt: now(), completedAt: null, metadata: { correlationId, idempotencyKey: run.idempotencyKey },
    }
    await this.safety.recordRecovery(recovery, actor, 'RECOVERY_STARTED')
    if (result && idem?.status === 'COMPLETED') {
      recovery.status = 'COMPLETED'; recovery.completedAt = now(); recovery.metadata = { ...recovery.metadata, resultId: result.id }
      await this.safety.recordRecovery(recovery, actor, 'RECOVERY_COMPLETED')
      return { recovery, result }
    }
    recovery.status = 'BLOCKED'; recovery.completedAt = now()
    await this.safety.recordRecovery(recovery, actor, 'RECOVERY_BLOCKED')
    if (recovery.outcome === 'UNKNOWN') {
      await this.safety.triggerSafeStop('TASK', run.taskId, run.workspaceId, 'Recovery blocked: unknown side-effect outcome', actor, correlationId)
      await this.safety.createIncident('CRITICAL', context, 'UNKNOWN', 'Manual inspection is required before recovery', actor, { recoveryId: recovery.id })
    }
    return { recovery, result: null }
  }

  getSafetyController() { return this.safety }

  async getResult(id: string, actor: Actor) {
    const result = await this.repo.getResult(id)
    if (!result) throw notFound('Execution result')
    await this.requireTask(result.taskId, actor)
    return result
  }

  async listResults(actor: Actor) {
    const values = await this.repo.listResults()
    if (actor.type === 'OWNER' && actor.id === this.ownerId) return values
    const visible: ExecutionResult[] = []
    for (const value of values) { try { await this.requireTask(value.taskId, actor); visible.push(value) } catch { /* default deny */ } }
    return visible
  }
}
