import type { AuditEvent, Capability, CapabilityPromotion, ConfigurationRevision, ExecutionPlan, ExecutionResult, IdempotencyRecord, Incident, LearningSignal, OptimizationProposal, OutcomeRecord, PerformanceMeasurement, Policy, RecoveryRecord, Run, SafeStop, Task, TelemetryRecord, Workspace } from '../domain/models'
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
  private incidents = new Map<string, Incident>()
  private safeStops = new Map<string, SafeStop>()
  private recoveries = new Map<string, RecoveryRecord>()
  private telemetryRecords = new Map<string, TelemetryRecord>()
  private outcomes = new Map<string, OutcomeRecord>()
  private learningSignals = new Map<string, LearningSignal>()
  private optimizationProposals = new Map<string, OptimizationProposal>()
  private configurationRevisions = new Map<string, ConfigurationRevision>()
  private performanceMeasurements = new Map<string, PerformanceMeasurement>()
  private capabilityPromotions = new Map<string, CapabilityPromotion>()
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

  async createIncident(value: Incident) { this.incidents.set(value.id, copy(value)) }
  async getIncident(id: string) { return copy(this.incidents.get(id) ?? null) }
  async listIncidents() { return copy([...this.incidents.values()]) }
  async saveIncident(value: Incident) { this.incidents.set(value.id, copy(value)) }

  async createSafeStop(value: SafeStop) { this.safeStops.set(value.id, copy(value)) }
  async getSafeStop(id: string) { return copy(this.safeStops.get(id) ?? null) }
  async listSafeStops() { return copy([...this.safeStops.values()]) }
  async saveSafeStop(value: SafeStop) { this.safeStops.set(value.id, copy(value)) }

  async createRecovery(value: RecoveryRecord) { this.recoveries.set(value.id, copy(value)) }
  async getRecovery(id: string) { return copy(this.recoveries.get(id) ?? null) }
  async listRecoveries() { return copy([...this.recoveries.values()]) }
  async saveRecovery(value: RecoveryRecord) { this.recoveries.set(value.id, copy(value)) }

  async createTelemetry(value: TelemetryRecord) { this.telemetryRecords.set(value.id, copy(value)) }
  async listTelemetry() { return copy([...this.telemetryRecords.values()]) }

  async createOutcome(value: OutcomeRecord) { this.outcomes.set(value.id, copy(value)) }
  async getOutcome(id: string) { return copy(this.outcomes.get(id) ?? null) }
  async listOutcomes() { return copy([...this.outcomes.values()]) }

  async createLearningSignal(value: LearningSignal) { this.learningSignals.set(value.id, copy(value)) }
  async getLearningSignal(id: string) { return copy(this.learningSignals.get(id) ?? null) }
  async listLearningSignals() { return copy([...this.learningSignals.values()]) }

  async createOptimizationProposal(value: OptimizationProposal) { this.optimizationProposals.set(value.id, copy(value)) }
  async getOptimizationProposal(id: string) { return copy(this.optimizationProposals.get(id) ?? null) }
  async listOptimizationProposals() { return copy([...this.optimizationProposals.values()]) }
  async saveOptimizationProposal(value: OptimizationProposal) { this.optimizationProposals.set(value.id, copy(value)) }

  async createConfigurationRevision(value: ConfigurationRevision) { this.configurationRevisions.set(value.id, copy(value)) }
  async getConfigurationRevision(id: string) { return copy(this.configurationRevisions.get(id) ?? null) }
  async listConfigurationRevisions() { return copy([...this.configurationRevisions.values()]) }
  async saveConfigurationRevision(value: ConfigurationRevision) { this.configurationRevisions.set(value.id, copy(value)) }

  async createPerformanceMeasurement(value: PerformanceMeasurement) { this.performanceMeasurements.set(value.id, copy(value)) }
  async getPerformanceMeasurement(id: string) { return copy(this.performanceMeasurements.get(id) ?? null) }
  async listPerformanceMeasurements() { return copy([...this.performanceMeasurements.values()]) }

  async createCapabilityPromotion(value: CapabilityPromotion) { this.capabilityPromotions.set(value.id, copy(value)) }
  async getCapabilityPromotion(id: string) { return copy(this.capabilityPromotions.get(id) ?? null) }
  async listCapabilityPromotions() { return copy([...this.capabilityPromotions.values()]) }
  async saveCapabilityPromotion(value: CapabilityPromotion) { this.capabilityPromotions.set(value.id, copy(value)) }

  async appendEvent(value: AuditEvent) { if (this.events.has(value.id)) throw new Error('Audit events are immutable'); this.events.set(value.id, copy(value)) }
  async getEvent(id: string) { return copy(this.events.get(id) ?? null) }
  async listEvents() { return copy([...this.events.values()]) }
}
