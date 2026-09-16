import { conflict, forbidden, invalid, notFound } from '../domain/errors'
import type {
  Actor, AuditEvent, ConcurrencyPolicy, EventType, FailureClass, Incident, IncidentSeverity,
  RecoveryRecord, SafeStop, SafeStopScope, TelemetryRecord,
} from '../domain/models'
import type { Repository } from '../ports/repository'
import { assertNoPlaintextSecrets, redactSecrets } from '../security/secrets'
import { newId, now } from '../shared/ids'

export type ExecutionContext = {
  correlationId: string
  workspaceId: string
  taskId: string
  runId?: string | null
  capabilityId?: string | null
  stepId?: string | null
}

const DEFAULT_LIMITS: ConcurrencyPolicy = { core: 50, workspace: 10, capability: 5, task: 1 }
const ACTIVE_RUNS = new Set(['DISPATCHED', 'RUNNING', 'RETRYING'])

export class SafetyController {
  constructor(
    private readonly repo: Repository,
    private readonly ownerId = 'owner_halstral',
    private readonly limits: ConcurrencyPolicy = DEFAULT_LIMITS,
  ) {}

  private requireOwner(actor: Actor) {
    if (actor.type !== 'OWNER' || actor.id !== this.ownerId) throw forbidden('Only the owner may perform this safety operation')
  }

  async audit(type: EventType, actor: Actor, context: Partial<ExecutionContext>, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
    assertNoPlaintextSecrets(metadata)
    const safeMetadata = redactSecrets({ correlationId: context.correlationId ?? newId('corr'), ...metadata }) as Record<string, unknown>
    const event: AuditEvent = {
      id: newId('evt'), type, actor, workspaceId: context.workspaceId ?? null, resourceType, resourceId,
      timestamp: now(), metadata: safeMetadata,
    }
    await this.repo.appendEvent(event)
    return event
  }

  async telemetry(actor: Actor, context: Partial<ExecutionContext>, status: string, options: {
    durationMs?: number | null
    errorClass?: FailureClass | null
    retryCount?: number
    policyOutcome?: TelemetryRecord['policyOutcome']
    metadata?: Record<string, unknown>
  } = {}) {
    const metadata = options.metadata ?? {}
    assertNoPlaintextSecrets(metadata)
    const record: TelemetryRecord = {
      id: newId('tel'), correlationId: context.correlationId ?? newId('corr'), taskId: context.taskId ?? null,
      runId: context.runId ?? null, workspaceId: context.workspaceId ?? null, capabilityId: context.capabilityId ?? null,
      actor, timestamp: now(), durationMs: options.durationMs ?? null, status, errorClass: options.errorClass ?? null,
      retryCount: options.retryCount ?? 0, policyOutcome: options.policyOutcome ?? 'NOT_EVALUATED',
      metadata: redactSecrets(metadata) as Record<string, unknown>,
    }
    await this.repo.createTelemetry(record)
    return record
  }

  classify(error: unknown): { errorClass: FailureClass; code: string; message: string; retryable: boolean; outcomeUnknown: boolean } {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const cancelled = error.message.toLowerCase().includes('cancel')
      return cancelled
        ? { errorClass: 'CANCELLED', code: 'CANCELLED', message: 'Execution cancelled', retryable: false, outcomeUnknown: false }
        : { errorClass: 'TIMEOUT', code: 'TIMEOUT', message: 'Execution timed out', retryable: true, outcomeUnknown: true }
    }
    if (error && typeof error === 'object') {
      const value = error as { code?: string; message?: string; kind?: string; retryable?: boolean; outcomeUnknown?: boolean }
      const kindMap: Record<string, FailureClass> = {
        TRANSIENT: 'TRANSIENT', INVALID_INPUT: 'VALIDATION', AUTHORIZATION: 'AUTHORIZATION', CREDENTIAL: 'CREDENTIAL',
        EXTERNAL_REFUSAL: 'EXTERNAL_SERVICE', TIMEOUT: 'TIMEOUT', UNSAFE_IDEMPOTENCY: 'CRITICAL', SYSTEM: 'SYSTEM', CRITICAL: 'CRITICAL',
      }
      const errorClass = kindMap[value.kind ?? ''] ?? (value.code === 'CANCELLED' ? 'CANCELLED' : 'UNKNOWN')
      const messages: Record<FailureClass, string> = {
        TRANSIENT: 'Transient execution failure', VALIDATION: 'Execution validation failed', AUTHORIZATION: 'Execution authorization denied',
        CREDENTIAL: 'Credential unavailable or invalid', EXTERNAL_SERVICE: 'External service execution failed', TIMEOUT: 'Execution timed out',
        CANCELLED: 'Execution cancelled', SYSTEM: 'Controlled system execution failed', UNKNOWN: 'Execution failed with an unknown error',
        CRITICAL: 'Critical execution safety failure',
      }
      const code = typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value.code) ? value.code : 'UNKNOWN_FAILURE'
      return {
        errorClass, code, message: messages[errorClass],
        retryable: Boolean(value.retryable) && ['TRANSIENT', 'EXTERNAL_SERVICE', 'TIMEOUT'].includes(errorClass),
        outcomeUnknown: Boolean(value.outcomeUnknown) || errorClass === 'UNKNOWN' || errorClass === 'CRITICAL' || errorClass === 'TIMEOUT',
      }
    }
    return { errorClass: 'UNKNOWN', code: 'UNKNOWN_FAILURE', message: 'Execution failed with an unknown error', retryable: false, outcomeUnknown: true }
  }

  async assertNoSafeStop(context: ExecutionContext) {
    const stops = (await this.repo.listSafeStops()).filter((stop) => stop.active)
    const blocked = stops.find((stop) =>
      stop.scope === 'CORE' ||
      (stop.scope === 'WORKSPACE' && stop.scopeId === context.workspaceId) ||
      (stop.scope === 'TASK' && stop.scopeId === context.taskId) ||
      (stop.scope === 'RUN' && stop.scopeId === context.runId) ||
      (stop.scope === 'CAPABILITY' && stop.scopeId === context.capabilityId) ||
      (stop.scope === 'STEP' && stop.scopeId === context.stepId))
    if (blocked) throw forbidden(`Protected execution stopped at ${blocked.scope}:${blocked.scopeId}`)
  }

  async assertConcurrency(actor: Actor, context: ExecutionContext) {
    const active = (await this.repo.listRuns()).filter((run) => ACTIVE_RUNS.has(run.status))
    const checks = [
      { scope: 'CORE', count: active.length, limit: this.limits.core },
      { scope: 'WORKSPACE', count: active.filter((run) => run.workspaceId === context.workspaceId).length, limit: this.limits.workspace },
      { scope: 'CAPABILITY', count: active.filter((run) => run.idempotencyKey?.includes(`:${context.capabilityId}:`)).length, limit: this.limits.capability },
      { scope: 'TASK', count: active.filter((run) => run.taskId === context.taskId).length, limit: this.limits.task },
    ]
    const reached = checks.find((check) => check.count >= check.limit)
    if (!reached) return
    await this.audit('CONCURRENCY_LIMIT_REACHED', actor, context, 'concurrency', reached.scope, { count: reached.count, limit: reached.limit })
    await this.telemetry(actor, context, 'BLOCKED', { errorClass: 'SYSTEM', metadata: { reason: 'CONCURRENCY_LIMIT_REACHED', scope: reached.scope } })
    throw conflict(`Concurrency limit reached for ${reached.scope}`)
  }

  async triggerSafeStop(scope: SafeStopScope, scopeId: string, workspaceId: string | null, reason: string, actor: Actor, correlationId = newId('corr')) {
    if (!scopeId.trim() || !reason.trim()) throw invalid('scopeId and reason are required')
    let resolvedWorkspaceId = workspaceId
    if (scope === 'WORKSPACE') {
      if (!await this.repo.getWorkspace(scopeId)) throw notFound('Workspace')
      if (workspaceId && workspaceId !== scopeId) throw invalid('Safe-stop workspace scope mismatch')
      resolvedWorkspaceId = scopeId
    } else if (scope === 'TASK') {
      const task = await this.repo.getTask(scopeId); if (!task) throw notFound('Task')
      if (workspaceId && workspaceId !== task.workspaceId) throw invalid('Safe-stop task workspace mismatch')
      resolvedWorkspaceId = task.workspaceId
    } else if (scope === 'RUN') {
      const run = await this.repo.getRun(scopeId); if (!run) throw notFound('Run')
      if (workspaceId && workspaceId !== run.workspaceId) throw invalid('Safe-stop run workspace mismatch')
      resolvedWorkspaceId = run.workspaceId
    } else if (scope === 'CAPABILITY') {
      const capability = await this.repo.getCapability(scopeId); if (!capability) throw notFound('Capability')
      if (workspaceId && capability.workspaceId && workspaceId !== capability.workspaceId) throw invalid('Safe-stop capability workspace mismatch')
      resolvedWorkspaceId = capability.workspaceId ?? workspaceId
    } else if (scope === 'STEP') {
      const plan = (await this.repo.listPlans()).find((candidate) => candidate.steps.some((step) => step.id === scopeId))
      if (!plan) throw notFound('Execution step')
      if (workspaceId && workspaceId !== plan.workspaceId) throw invalid('Safe-stop step workspace mismatch')
      resolvedWorkspaceId = plan.workspaceId
    } else if (scope === 'CORE') resolvedWorkspaceId = null
    const existing = (await this.repo.listSafeStops()).find((stop) => stop.active && stop.scope === scope && stop.scopeId === scopeId)
    if (existing) return existing
    const stop: SafeStop = { id: newId('stop'), scope, scopeId, workspaceId: resolvedWorkspaceId, reason, active: true, triggeredBy: actor, triggeredAt: now(), releasedBy: null, releasedAt: null }
    await this.repo.createSafeStop(stop)
    await this.audit('SAFE_STOP_TRIGGERED', actor, { correlationId, workspaceId: resolvedWorkspaceId ?? undefined }, 'safe_stop', stop.id, { scope, scopeId, reason })
    return stop
  }

  async releaseSafeStop(id: string, actor: Actor, correlationId = newId('corr')) {
    this.requireOwner(actor)
    const stop = await this.repo.getSafeStop(id)
    if (!stop) throw notFound('Safe stop')
    if (!stop.active) throw conflict('Safe stop is already released')
    stop.active = false; stop.releasedBy = actor; stop.releasedAt = now(); await this.repo.saveSafeStop(stop)
    await this.audit('SAFE_STOP_RELEASED', actor, { correlationId, workspaceId: stop.workspaceId ?? undefined }, 'safe_stop', stop.id, { scope: stop.scope, scopeId: stop.scopeId })
    return stop
  }

  async createIncident(severity: IncidentSeverity, context: ExecutionContext, category: FailureClass, summary: string, actor: Actor, metadata: Record<string, unknown> = {}) {
    assertNoPlaintextSecrets(metadata)
    const existing = (await this.repo.listIncidents()).find((incident) => incident.workspaceId === context.workspaceId && incident.runId === (context.runId ?? null) && incident.category === category && !['RESOLVED', 'CLOSED'].includes(incident.status))
    if (existing) return existing
    const incident: Incident = {
      id: newId('inc'), severity, workspaceId: context.workspaceId, taskId: context.taskId, runId: context.runId ?? null,
      category, summary, status: 'OPEN', detectedAt: now(), resolvedAt: null,
      metadata: redactSecrets({ correlationId: context.correlationId, capabilityId: context.capabilityId, ...metadata }) as Record<string, unknown>,
    }
    await this.repo.createIncident(incident)
    await this.audit('INCIDENT_CREATED', actor, context, 'incident', incident.id, { severity, category, summary })
    return incident
  }

  async resolveIncident(id: string, actor: Actor, status: Incident['status'] = 'RESOLVED', correlationId = newId('corr')) {
    this.requireOwner(actor)
    if (!['MITIGATED', 'RESOLVED', 'CLOSED'].includes(status)) throw invalid('Resolution status must be MITIGATED, RESOLVED, or CLOSED')
    const incident = await this.repo.getIncident(id)
    if (!incident) throw notFound('Incident')
    incident.status = status; incident.resolvedAt = status === 'MITIGATED' ? null : now(); await this.repo.saveIncident(incident)
    await this.audit('INCIDENT_RESOLVED', actor, { correlationId, workspaceId: incident.workspaceId, taskId: incident.taskId ?? undefined, runId: incident.runId }, 'incident', incident.id, { status })
    return incident
  }

  async recordRecovery(record: RecoveryRecord, actor: Actor, event: 'RECOVERY_STARTED' | 'RECOVERY_COMPLETED' | 'RECOVERY_BLOCKED') {
    assertNoPlaintextSecrets(record.metadata)
    if (event === 'RECOVERY_STARTED') await this.repo.createRecovery(record)
    else await this.repo.saveRecovery(record)
    await this.audit(event, actor, { correlationId: String(record.metadata.correlationId ?? newId('corr')), workspaceId: record.workspaceId, taskId: record.taskId, runId: record.runId }, 'recovery', record.id, { outcome: record.outcome, strategy: record.strategy, status: record.status })
    return record
  }

  async listIncidents(actor: Actor) { this.requireOwner(actor); return this.repo.listIncidents() }
  async listSafeStops(actor: Actor) { this.requireOwner(actor); return this.repo.listSafeStops() }
  async listRecoveries(actor: Actor) { this.requireOwner(actor); return this.repo.listRecoveries() }
  async listTelemetry(actor: Actor) { this.requireOwner(actor); return this.repo.listTelemetry() }
}
