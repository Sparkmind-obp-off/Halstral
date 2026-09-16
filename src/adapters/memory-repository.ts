import type { AuditEvent, Capability, ExecutionPlan, ExecutionResult, IdempotencyRecord, Policy, Run, Task, Workspace } from '../domain/models'
import type { Repository } from '../ports/repository'

const copy = <T>(value: T): T => structuredClone(value)

export class MemoryRepository implements Repository {
  private workspaces = new Map<string, Workspace>()
  private capabilities = new Map<string, Capability>()
  private policies = new Map<string, Policy>()
  private tasks = new Map<string, Task>()
  private runs = new Map<string, Run>()
  private plans = new Map<string, ExecutionPlan>()
  private results = new Map<string, ExecutionResult>()
  private idempotency = new Map<string, IdempotencyRecord>()
  private events = new Map<string, AuditEvent>()

  async createWorkspace(value: Workspace) { if ([...this.workspaces.values()].some((item) => item.slug === value.slug)) throw new Error('UNIQUE constraint failed: workspaces.slug'); this.workspaces.set(value.id, copy(value)) }
  async getWorkspace(id: string) { return copy(this.workspaces.get(id) ?? null) }
  async listWorkspaces() { return copy([...this.workspaces.values()]) }
  async saveWorkspace(value: Workspace) { this.workspaces.set(value.id, copy(value)) }

  async createCapability(value: Capability) { this.capabilities.set(value.id, copy(value)) }
  async getCapability(id: string) { return copy(this.capabilities.get(id) ?? null) }
  async listCapabilities() { return copy([...this.capabilities.values()]) }
  async saveCapability(value: Capability) { this.capabilities.set(value.id, copy(value)) }

  async createPolicy(value: Policy) { this.policies.set(value.id, copy(value)) }
  async getPolicy(id: string) { return copy(this.policies.get(id) ?? null) }
  async listPolicies() { return copy([...this.policies.values()]) }
  async savePolicy(value: Policy) { this.policies.set(value.id, copy(value)) }

  async createTask(value: Task) { this.tasks.set(value.id, copy(value)) }
  async getTask(id: string) { return copy(this.tasks.get(id) ?? null) }
  async listTasks() { return copy([...this.tasks.values()]) }
  async saveTask(value: Task) { this.tasks.set(value.id, copy(value)) }

  async createRun(value: Run) { this.runs.set(value.id, copy(value)) }
  async getRun(id: string) { return copy(this.runs.get(id) ?? null) }
  async listRuns() { return copy([...this.runs.values()]) }
  async saveRun(value: Run) { this.runs.set(value.id, copy(value)) }

  async createPlan(value: ExecutionPlan) { this.plans.set(value.id, copy(value)) }
  async getPlan(id: string) { return copy(this.plans.get(id) ?? null) }
  async getPlanByTask(taskId: string) { return copy([...this.plans.values()].find((item) => item.taskId === taskId) ?? null) }
  async listPlans() { return copy([...this.plans.values()]) }
  async savePlan(value: ExecutionPlan) { this.plans.set(value.id, copy(value)) }

  async createResult(value: ExecutionResult) { this.results.set(value.id, copy(value)) }
  async getResult(id: string) { return copy(this.results.get(id) ?? null) }
  async listResults() { return copy([...this.results.values()]) }

  async createIdempotencyRecord(value: IdempotencyRecord) { if (this.idempotency.has(value.key)) return false; this.idempotency.set(value.key, copy(value)); return true }
  async getIdempotencyRecord(key: string) { return copy(this.idempotency.get(key) ?? null) }
  async saveIdempotencyRecord(value: IdempotencyRecord) { this.idempotency.set(value.key, copy(value)) }

  async appendEvent(value: AuditEvent) { if (this.events.has(value.id)) throw new Error('Audit events are immutable'); this.events.set(value.id, copy(value)) }
  async getEvent(id: string) { return copy(this.events.get(id) ?? null) }
  async listEvents() { return copy([...this.events.values()]) }
}
