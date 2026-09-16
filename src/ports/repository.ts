import type { AuditEvent, Capability, ExecutionPlan, ExecutionResult, IdempotencyRecord, Policy, Run, Task, Workspace } from '../domain/models'

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

  createPlan(value: ExecutionPlan): Promise<void>
  getPlan(id: string): Promise<ExecutionPlan | null>
  getPlanByTask(taskId: string): Promise<ExecutionPlan | null>
  listPlans(): Promise<ExecutionPlan[]>
  savePlan(value: ExecutionPlan): Promise<void>

  createResult(value: ExecutionResult): Promise<void>
  getResult(id: string): Promise<ExecutionResult | null>
  listResults(): Promise<ExecutionResult[]>

  createIdempotencyRecord(value: IdempotencyRecord): Promise<boolean>
  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>
  saveIdempotencyRecord(value: IdempotencyRecord): Promise<void>

  appendEvent(value: AuditEvent): Promise<void>
  getEvent(id: string): Promise<AuditEvent | null>
  listEvents(): Promise<AuditEvent[]>
}
