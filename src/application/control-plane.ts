import { conflict, forbidden, invalid, notFound } from '../domain/errors'
import { canTransitionRun, canTransitionTask } from '../domain/lifecycle'
import {
  CAPABILITY_STATUSES, POLICY_EFFECTS, POLICY_STATUSES, RUN_STATUSES, TASK_STATUSES,
  type Actor, type AuditEvent, type Capability, type EventType, type Policy, type Run, type RunStatus,
  type Task, type TaskStatus, type Workspace,
} from '../domain/models'
import { evaluateAuthorization } from '../policy/evaluator'
import type { Repository } from '../ports/repository'
import { assertNoPlaintextSecrets, redactSecrets } from '../security/secrets'
import { newId, now } from '../shared/ids'

type ObjectInput = Record<string, unknown>
function text(value: unknown, field: string): string
function text(value: unknown, field: string, required: true): string
function text(value: unknown, field: string, required: false): string | undefined
function text(value: unknown, field: string, required = true): string | undefined {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && !value.trim())) throw invalid(`${field} must be a non-empty string`)
  return value.trim()
}
const oneOf = <T extends string>(value: unknown, values: readonly T[], field: string, fallback?: T): T => {
  const candidate = value ?? fallback
  if (!values.includes(candidate as T)) throw invalid(`${field} must be one of: ${values.join(', ')}`)
  return candidate as T
}
const object = (value: unknown, field: string) => {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`${field} must be an object`)
  return value as Record<string, unknown>
}

export class ControlPlane {
  constructor(private readonly repo: Repository, private readonly ownerId = 'owner_halstral') {}

  private async audit(type: EventType, actor: Actor, workspaceId: string | null, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
    assertNoPlaintextSecrets(metadata)
    const event: AuditEvent = { id: newId('evt'), type, actor, workspaceId, resourceType, resourceId, timestamp: now(), metadata: redactSecrets(metadata) as Record<string, unknown> }
    await this.repo.appendEvent(event)
    return event
  }

  private async authorize(actor: Actor, workspaceId: string | null, resource: string, action: string) {
    const decision = evaluateAuthorization({ actor, ownerId: this.ownerId, workspaceId, resource, action, policies: await this.repo.listPolicies() })
    await this.audit(decision.effect === 'ALLOW' ? 'AUTHORIZATION_GRANTED' : 'AUTHORIZATION_DENIED', actor, workspaceId, 'authorization', resource, { action, outcome: decision.effect, reason: decision.reason, policyId: decision.policyId, approvalRequired: decision.approvalRequired })
    if (decision.effect === 'DENY') throw forbidden(`Authorization denied: ${decision.reason}`)
    if (decision.approvalRequired) throw forbidden('Owner approval is required and no approval reference was provided')
    return decision
  }

  private async ownerOnly(actor: Actor, workspaceId: string | null, resource: string, action: string) {
    await this.authorize(actor, workspaceId, resource, action)
    if (actor.type !== 'OWNER' || actor.id !== this.ownerId) throw forbidden('Only the owner may perform this operation')
  }

  async createWorkspace(input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input)
    const id = text(input.id, 'id', false) ?? newId('ws')
    await this.ownerOnly(actor, id, `workspace:${id}`, 'create')
    const timestamp = now()
    const value: Workspace = {
      id,
      slug: text(input.slug, 'slug'),
      name: text(input.name, 'name'),
      description: text(input.description, 'description', false) ?? '',
      status: oneOf(input.status, ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const, 'status', 'ACTIVE'),
      ownerId: text(input.ownerId, 'ownerId'),
      environment: text(input.environment, 'environment'),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) throw invalid('slug must use lowercase letters, numbers, and hyphens')
    try { await this.repo.createWorkspace(value) } catch (error) { if (String(error).includes('UNIQUE')) throw conflict('Workspace slug must be unique'); throw error }
    await this.audit('WORKSPACE_CREATED', actor, value.id, 'workspace', value.id, { outcome: 'SUCCESS' })
    return value
  }

  async getWorkspace(id: string, actor: Actor) { const value = await this.repo.getWorkspace(id); if (!value) throw notFound('Workspace'); await this.authorize(actor, id, `workspace:${id}`, 'read'); return value }
  async listWorkspaces(actor: Actor) {
    const values = await this.repo.listWorkspaces()
    if (actor.type === 'OWNER' && actor.id === this.ownerId) { await this.authorize(actor, null, 'workspace:*', 'list'); return values }
    const visible: Workspace[] = []
    for (const value of values) { try { await this.authorize(actor, value.id, `workspace:${value.id}`, 'read'); visible.push(value) } catch (error) { if (!(error instanceof Error) || !error.message.startsWith('Authorization denied')) throw error } }
    return visible
  }
  async updateWorkspace(id: string, input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input); await this.ownerOnly(actor, id, `workspace:${id}`, 'update')
    const value = await this.repo.getWorkspace(id); if (!value) throw notFound('Workspace')
    if (input.slug !== undefined) value.slug = text(input.slug, 'slug')
    if (input.name !== undefined) value.name = text(input.name, 'name')
    if (input.description !== undefined) value.description = text(input.description, 'description')
    if (input.environment !== undefined) value.environment = text(input.environment, 'environment')
    value.updatedAt = now(); await this.repo.saveWorkspace(value); await this.audit('WORKSPACE_UPDATED', actor, id, 'workspace', id, { fields: Object.keys(input), outcome: 'SUCCESS' }); return value
  }
  async suspendWorkspace(id: string, actor: Actor) { await this.ownerOnly(actor, id, `workspace:${id}`, 'suspend'); const value = await this.repo.getWorkspace(id); if (!value) throw notFound('Workspace'); if (value.status === 'ARCHIVED') throw conflict('Archived workspace cannot be suspended'); value.status = 'SUSPENDED'; value.updatedAt = now(); await this.repo.saveWorkspace(value); await this.audit('WORKSPACE_SUSPENDED', actor, id, 'workspace', id, { outcome: 'SUCCESS' }); return value }
  async archiveWorkspace(id: string, actor: Actor) { await this.ownerOnly(actor, id, `workspace:${id}`, 'archive'); const value = await this.repo.getWorkspace(id); if (!value) throw notFound('Workspace'); value.status = 'ARCHIVED'; value.updatedAt = now(); await this.repo.saveWorkspace(value); await this.audit('WORKSPACE_ARCHIVED', actor, id, 'workspace', id, { outcome: 'SUCCESS' }); return value }

  async createCapability(input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input); const id = text(input.id, 'id', false) ?? newId('cap'); const ownerScope = oneOf(input.ownerScope, ['CORE', 'WORKSPACE'] as const, 'ownerScope'); const workspaceId = ownerScope === 'WORKSPACE' ? text(input.workspaceId, 'workspaceId') : null
    await this.ownerOnly(actor, workspaceId, `capability:${id}`, 'create'); if (workspaceId && !await this.repo.getWorkspace(workspaceId)) throw notFound('Workspace')
    const timestamp = now(); const value: Capability = { id, name: text(input.name, 'name'), description: text(input.description, 'description', false) ?? '', ownerScope, workspaceId, riskLevel: oneOf(input.riskLevel, ['LOW','MEDIUM','HIGH'] as const, 'riskLevel'), inputSchema: object(input.inputSchema, 'inputSchema'), outputSchema: object(input.outputSchema, 'outputSchema'), status: oneOf(input.status, CAPABILITY_STATUSES, 'status', 'ACTIVE'), createdAt: timestamp, updatedAt: timestamp }
    await this.repo.createCapability(value); await this.audit('CAPABILITY_CREATED', actor, workspaceId, 'capability', id, { ownerScope, riskLevel: value.riskLevel, outcome: 'SUCCESS' }); return value
  }
  async getCapability(id: string, actor: Actor) { const value = await this.repo.getCapability(id); if (!value) throw notFound('Capability'); await this.authorize(actor, value.workspaceId, `capability:${id}`, 'read'); return value }
  async listCapabilities(actor: Actor) { const values = await this.repo.listCapabilities(); if (actor.type === 'OWNER' && actor.id === this.ownerId) { await this.authorize(actor, null, 'capability:*', 'list'); return values } const visible: Capability[] = []; for (const value of values) { try { await this.authorize(actor, value.workspaceId, `capability:${value.id}`, 'read'); visible.push(value) } catch (error) { if (!(error instanceof Error) || !error.message.startsWith('Authorization denied')) throw error } } return visible }
  async updateCapability(id: string, input: ObjectInput, actor: Actor) { assertNoPlaintextSecrets(input); const value = await this.repo.getCapability(id); if (!value) throw notFound('Capability'); await this.ownerOnly(actor, value.workspaceId, `capability:${id}`, 'update'); if (input.name !== undefined) value.name = text(input.name, 'name'); if (input.description !== undefined) value.description = text(input.description, 'description'); if (input.riskLevel !== undefined) value.riskLevel = oneOf(input.riskLevel, ['LOW','MEDIUM','HIGH'] as const, 'riskLevel'); if (input.inputSchema !== undefined) value.inputSchema = object(input.inputSchema, 'inputSchema'); if (input.outputSchema !== undefined) value.outputSchema = object(input.outputSchema, 'outputSchema'); if (input.status !== undefined) value.status = oneOf(input.status, CAPABILITY_STATUSES, 'status'); value.updatedAt = now(); await this.repo.saveCapability(value); await this.audit('CAPABILITY_UPDATED', actor, value.workspaceId, 'capability', id, { fields: Object.keys(input), outcome: 'SUCCESS' }); return value }
  async disableCapability(id: string, actor: Actor) { const value = await this.repo.getCapability(id); if (!value) throw notFound('Capability'); await this.ownerOnly(actor, value.workspaceId, `capability:${id}`, 'disable'); value.status = 'DISABLED'; value.updatedAt = now(); await this.repo.saveCapability(value); await this.audit('CAPABILITY_DISABLED', actor, value.workspaceId, 'capability', id, { outcome: 'SUCCESS' }); return value }

  async createPolicy(input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input); const id = text(input.id, 'id', false) ?? newId('pol'); const workspaceId = text(input.workspaceId, 'workspaceId'); await this.ownerOnly(actor, workspaceId, `policy:${id}`, 'create'); if (!await this.repo.getWorkspace(workspaceId)) throw notFound('Workspace')
    const timestamp = now(); const value: Policy = { id, name: text(input.name, 'name'), workspaceId, subject: text(input.subject, 'subject'), resource: text(input.resource, 'resource'), action: text(input.action, 'action'), scope: text(input.scope, 'scope'), effect: oneOf(input.effect, POLICY_EFFECTS, 'effect'), approvalRequired: Boolean(input.approvalRequired), status: oneOf(input.status, POLICY_STATUSES, 'status', 'ACTIVE'), createdAt: timestamp, updatedAt: timestamp }
    await this.repo.createPolicy(value); await this.audit('POLICY_CREATED', actor, workspaceId, 'policy', id, { effect: value.effect, subject: value.subject, resource: value.resource, action: value.action, outcome: 'SUCCESS' }); return value
  }
  async getPolicy(id: string, actor: Actor) { const value = await this.repo.getPolicy(id); if (!value) throw notFound('Policy'); await this.ownerOnly(actor, value.workspaceId, `policy:${id}`, 'read'); return value }
  async listPolicies(actor: Actor) { await this.ownerOnly(actor, null, 'policy:*', 'list'); return this.repo.listPolicies() }
  async updatePolicy(id: string, input: ObjectInput, actor: Actor) { assertNoPlaintextSecrets(input); const value = await this.repo.getPolicy(id); if (!value) throw notFound('Policy'); await this.ownerOnly(actor, value.workspaceId, `policy:${id}`, 'update'); if (input.name !== undefined) value.name = text(input.name, 'name'); if (input.subject !== undefined) value.subject = text(input.subject, 'subject'); if (input.resource !== undefined) value.resource = text(input.resource, 'resource'); if (input.action !== undefined) value.action = text(input.action, 'action'); if (input.scope !== undefined) value.scope = text(input.scope, 'scope'); if (input.effect !== undefined) value.effect = oneOf(input.effect, POLICY_EFFECTS, 'effect'); if (input.approvalRequired !== undefined) value.approvalRequired = Boolean(input.approvalRequired); if (input.status !== undefined) value.status = oneOf(input.status, POLICY_STATUSES, 'status'); value.updatedAt = now(); await this.repo.savePolicy(value); await this.audit('POLICY_UPDATED', actor, value.workspaceId, 'policy', id, { fields: Object.keys(input), outcome: 'SUCCESS' }); return value }

  async createTask(input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input); const id = text(input.id, 'id', false) ?? newId('task'); const workspaceId = text(input.workspaceId, 'workspaceId'); await this.authorize(actor, workspaceId, `task:${id}`, 'create'); const workspace = await this.repo.getWorkspace(workspaceId); if (!workspace) throw notFound('Workspace'); if (workspace.status !== 'ACTIVE') { await this.audit('AUTHORIZATION_DENIED', actor, workspaceId, 'task', id, { action: 'create', outcome: 'DENY', reason: workspace.status === 'ARCHIVED' ? 'WORKSPACE_ARCHIVED' : 'WORKSPACE_NOT_ACTIVE' }); throw forbidden(`${workspace.status} workspace cannot receive new tasks`) }
    const capabilityId = text(input.capabilityId, 'capabilityId', false) ?? null
    if (capabilityId) { const capability = await this.repo.getCapability(capabilityId); if (!capability) throw notFound('Capability'); if (capability.status !== 'ACTIVE') { await this.audit('AUTHORIZATION_DENIED', actor, workspaceId, 'capability', capabilityId, { action: 'use', outcome: 'DENY', reason: 'CAPABILITY_DISABLED' }); throw forbidden('Disabled capability cannot be authorized for new use') } await this.authorize(actor, workspaceId, `capability:${capabilityId}`, 'use') }
    const credentialRef = text(input.credentialRef, 'credentialRef', false) ?? null; if (credentialRef !== null && !credentialRef.startsWith(`secret://workspace/${workspace.slug}/`)) throw invalid('credentialRef must belong to the task workspace')
    const timestamp = now(); const value: Task = { id, workspaceId, title: text(input.title, 'title'), description: text(input.description, 'description', false) ?? '', status: 'PENDING', capabilityId, credentialRef, createdAt: timestamp, updatedAt: timestamp }; await this.repo.createTask(value); await this.audit('TASK_CREATED', actor, workspaceId, 'task', id, { capabilityId, outcome: 'SUCCESS' }); return value
  }
  async getTask(id: string, actor: Actor) { const value = await this.repo.getTask(id); if (!value) throw notFound('Task'); await this.authorize(actor, value.workspaceId, `task:${id}`, 'read'); return value }
  async listTasks(actor: Actor) { const values = await this.repo.listTasks(); if (actor.type === 'OWNER' && actor.id === this.ownerId) { await this.authorize(actor, null, 'task:*', 'list'); return values } const visible: Task[] = []; for (const value of values) { try { await this.authorize(actor, value.workspaceId, `task:${value.id}`, 'read'); visible.push(value) } catch (error) { if (!(error instanceof Error) || !error.message.startsWith('Authorization denied')) throw error } } return visible }
  async updateTask(id: string, input: ObjectInput, actor: Actor) { assertNoPlaintextSecrets(input); const value = await this.repo.getTask(id); if (!value) throw notFound('Task'); await this.authorize(actor, value.workspaceId, `task:${id}`, 'update'); if (input.title !== undefined) value.title = text(input.title, 'title'); if (input.description !== undefined) value.description = text(input.description, 'description'); if (input.status !== undefined) { const status = oneOf(input.status, TASK_STATUSES, 'status'); if (!canTransitionTask(value.status, status)) throw conflict(`Invalid task transition: ${value.status} -> ${status}`); value.status = status } value.updatedAt = now(); await this.repo.saveTask(value); await this.audit('TASK_UPDATED', actor, value.workspaceId, 'task', id, { status: value.status, outcome: 'SUCCESS' }); return value }
  cancelTask(id: string, actor: Actor) { return this.updateTask(id, { status: 'CANCELLED' }, actor) }

  async createRun(input: ObjectInput, actor: Actor) {
    assertNoPlaintextSecrets(input); const taskId = text(input.taskId, 'taskId'); const task = await this.repo.getTask(taskId); if (!task) throw notFound('Task'); const id = text(input.id, 'id', false) ?? newId('run'); await this.authorize(actor, task.workspaceId, `run:${id}`, 'create'); const workspace = await this.repo.getWorkspace(task.workspaceId); if (!workspace) throw notFound('Workspace'); if (workspace.status !== 'ACTIVE') { await this.audit('AUTHORIZATION_DENIED', actor, task.workspaceId, 'run', id, { action: 'create', outcome: 'DENY', reason: workspace.status === 'SUSPENDED' ? 'WORKSPACE_SUSPENDED' : 'WORKSPACE_ARCHIVED' }); throw forbidden(`${workspace.status} workspace cannot execute actions`) }
    const timestamp = now(); const value: Run = { id, taskId, workspaceId: task.workspaceId, status: 'CREATED', startedAt: null, completedAt: null, error: null, createdAt: timestamp, updatedAt: timestamp }; await this.repo.createRun(value); await this.audit('RUN_CREATED', actor, value.workspaceId, 'run', id, { taskId, outcome: 'SUCCESS' }); return value
  }
  async getRun(id: string, actor: Actor) { const value = await this.repo.getRun(id); if (!value) throw notFound('Run'); await this.authorize(actor, value.workspaceId, `run:${id}`, 'read'); return value }
  async listRuns(actor: Actor) { const values = await this.repo.listRuns(); if (actor.type === 'OWNER' && actor.id === this.ownerId) { await this.authorize(actor, null, 'run:*', 'list'); return values } const visible: Run[] = []; for (const value of values) { try { await this.authorize(actor, value.workspaceId, `run:${value.id}`, 'read'); visible.push(value) } catch (error) { if (!(error instanceof Error) || !error.message.startsWith('Authorization denied')) throw error } } return visible }
  async updateRun(id: string, statusInput: unknown, actor: Actor, error?: unknown) { const value = await this.repo.getRun(id); if (!value) throw notFound('Run'); await this.authorize(actor, value.workspaceId, `run:${id}`, 'update'); const workspace = await this.repo.getWorkspace(value.workspaceId); if (!workspace || workspace.status !== 'ACTIVE') throw forbidden('Workspace cannot execute actions'); const status = oneOf(statusInput, RUN_STATUSES, 'status') as RunStatus; if (!canTransitionRun(value.status, status)) throw conflict(`Invalid run transition: ${value.status} -> ${status}`); value.status = status; value.updatedAt = now(); if (status === 'RUNNING') value.startedAt = value.updatedAt; if (['COMPLETED','FAILED','CANCELLED'].includes(status)) value.completedAt = value.updatedAt; if (status === 'FAILED') value.error = text(error, 'error', false) ?? 'Unspecified failure'; await this.repo.saveRun(value); const eventType: EventType = status === 'RUNNING' ? 'RUN_STARTED' : status === 'COMPLETED' ? 'RUN_COMPLETED' : status === 'FAILED' ? 'RUN_FAILED' : 'RUN_CANCELLED'; await this.audit(eventType, actor, value.workspaceId, 'run', id, { status, outcome: 'SUCCESS' }); return value }

  async getEvent(id: string, actor: Actor) { const value = await this.repo.getEvent(id); if (!value) throw notFound('Event'); await this.ownerOnly(actor, value.workspaceId, `event:${id}`, 'read'); return value }
  async listEvents(actor: Actor) { await this.ownerOnly(actor, null, 'event:*', 'list'); return this.repo.listEvents() }
}
