import type { AuditEvent, Capability, ExecutionPlan, ExecutionResult, IdempotencyRecord, Incident, Policy, RecoveryRecord, Run, SafeStop, Task, TelemetryRecord, Workspace } from '../domain/models'

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

  createIncident(value: Incident): Promise<void>
  getIncident(id: string): Promise<Incident | null>
  listIncidents(): Promise<Incident[]>
  saveIncident(value: Incident): Promise<void>

  createSafeStop(value: SafeStop): Promise<void>
  getSafeStop(id: string): Promise<SafeStop | null>
  listSafeStops(): Promise<SafeStop[]>
  saveSafeStop(value: SafeStop): Promise<void>

  createRecovery(value: RecoveryRecord): Promise<void>
  getRecovery(id: string): Promise<RecoveryRecord | null>
  listRecoveries(): Promise<RecoveryRecord[]>
  saveRecovery(value: RecoveryRecord): Promise<void>

  createTelemetry(value: TelemetryRecord): Promise<void>
  listTelemetry(): Promise<TelemetryRecord[]>

  appendEvent(value: AuditEvent): Promise<void>
  getEvent(id: string): Promise<AuditEvent | null>
  listEvents(): Promise<AuditEvent[]>
}
