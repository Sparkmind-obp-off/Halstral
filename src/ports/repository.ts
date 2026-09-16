import type { AuditEvent, Capability, Policy, Run, Task, Workspace } from '../domain/models'

export interface Repository {
  createWorkspace(value: Workspace): Promise<void>
  getWorkspace(id: string): Promise<Workspace | null>
  listWorkspaces(): Promise<Workspace[]>
  saveWorkspace(value: Workspace): Promise<void>

  createCapability(value: Capability): Promise<void>
  getCapability(id: string): Promise<Capability | null>
  listCapabilities(): Promise<Capability[]>
  saveCapability(value: Capability): Promise<void>

  createPolicy(value: Policy): Promise<void>
  getPolicy(id: string): Promise<Policy | null>
  listPolicies(): Promise<Policy[]>
  savePolicy(value: Policy): Promise<void>

  createTask(value: Task): Promise<void>
  getTask(id: string): Promise<Task | null>
  listTasks(): Promise<Task[]>
  saveTask(value: Task): Promise<void>

  createRun(value: Run): Promise<void>
  getRun(id: string): Promise<Run | null>
  listRuns(): Promise<Run[]>
  saveRun(value: Run): Promise<void>

  appendEvent(value: AuditEvent): Promise<void>
  getEvent(id: string): Promise<AuditEvent | null>
  listEvents(): Promise<AuditEvent[]>
}
