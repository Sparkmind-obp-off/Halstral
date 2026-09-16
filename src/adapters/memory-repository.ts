import type { AuditEvent, Capability, Policy, Run, Task, Workspace } from '../domain/models'
import type { Repository } from '../ports/repository'

const copy = <T>(value: T): T => structuredClone(value)

export class MemoryRepository implements Repository {
  private workspaces = new Map<string, Workspace>()
  private capabilities = new Map<string, Capability>()
  private policies = new Map<string, Policy>()
  private tasks = new Map<string, Task>()
  private runs = new Map<string, Run>()
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

  async appendEvent(value: AuditEvent) { if (this.events.has(value.id)) throw new Error('Audit events are immutable'); this.events.set(value.id, copy(value)) }
  async getEvent(id: string) { return copy(this.events.get(id) ?? null) }
  async listEvents() { return copy([...this.events.values()]) }
}
