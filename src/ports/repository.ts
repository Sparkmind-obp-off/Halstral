import type { AuditEvent, Capability, CapabilityPromotion, ConfigurationRevision, ExecutionPlan, ExecutionResult, IdempotencyRecord, Incident, LearningSignal, OptimizationProposal, OutcomeRecord, PerformanceMeasurement, Policy, RecoveryRecord, Run, SafeStop, Task, TelemetryRecord, Workspace } from '../domain/models'

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

  createOutcome(value: OutcomeRecord): Promise<void>
  getOutcome(id: string): Promise<OutcomeRecord | null>
  listOutcomes(): Promise<OutcomeRecord[]>

  createLearningSignal(value: LearningSignal): Promise<void>
  getLearningSignal(id: string): Promise<LearningSignal | null>
  listLearningSignals(): Promise<LearningSignal[]>

  createOptimizationProposal(value: OptimizationProposal): Promise<void>
  getOptimizationProposal(id: string): Promise<OptimizationProposal | null>
  listOptimizationProposals(): Promise<OptimizationProposal[]>
  saveOptimizationProposal(value: OptimizationProposal): Promise<void>

  createConfigurationRevision(value: ConfigurationRevision): Promise<void>
  getConfigurationRevision(id: string): Promise<ConfigurationRevision | null>
  listConfigurationRevisions(): Promise<ConfigurationRevision[]>
  saveConfigurationRevision(value: ConfigurationRevision): Promise<void>

  createPerformanceMeasurement(value: PerformanceMeasurement): Promise<void>
  getPerformanceMeasurement(id: string): Promise<PerformanceMeasurement | null>
  listPerformanceMeasurements(): Promise<PerformanceMeasurement[]>

  createCapabilityPromotion(value: CapabilityPromotion): Promise<void>
  getCapabilityPromotion(id: string): Promise<CapabilityPromotion | null>
  listCapabilityPromotions(): Promise<CapabilityPromotion[]>
  saveCapabilityPromotion(value: CapabilityPromotion): Promise<void>

  appendEvent(value: AuditEvent): Promise<void>
  getEvent(id: string): Promise<AuditEvent | null>
  listEvents(): Promise<AuditEvent[]>
}
