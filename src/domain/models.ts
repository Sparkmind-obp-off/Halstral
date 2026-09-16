export const WORKSPACE_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const
export const CAPABILITY_STATUSES = ['ACTIVE', 'DISABLED', 'DEPRECATED'] as const
export const POLICY_EFFECTS = ['ALLOW', 'DENY'] as const
export const POLICY_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const TASK_STATUSES = ['PENDING', 'CLASSIFIED', 'PLANNED', 'AUTHORIZED', 'DELEGATED', 'DISPATCHED', 'RUNNING', 'RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
export const RUN_STATUSES = ['CREATED', 'DISPATCHED', 'RUNNING', 'RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
export const PLAN_STATUSES = ['CREATED', 'AWAITING_APPROVAL', 'AUTHORIZED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'] as const
export const STEP_STATUSES = ['PENDING', 'AUTHORIZED', 'DISPATCHED', 'RUNNING', 'RETRYING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'] as const
export const APPROVAL_STATUSES = ['PENDING', 'GRANTED', 'DENIED'] as const

export type WorkspaceStatus = typeof WORKSPACE_STATUSES[number]
export type CapabilityStatus = typeof CAPABILITY_STATUSES[number]
export type PolicyEffect = typeof POLICY_EFFECTS[number]
export type PolicyStatus = typeof POLICY_STATUSES[number]
export type TaskStatus = typeof TASK_STATUSES[number]
export type RunStatus = typeof RUN_STATUSES[number]
export type PlanStatus = typeof PLAN_STATUSES[number]
export type StepStatus = typeof STEP_STATUSES[number]
export type ApprovalStatus = typeof APPROVAL_STATUSES[number]
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type Actor = { id: string; type: 'OWNER' | 'WORKSPACE' }

export interface Workspace {
  id: string
  slug: string
  name: string
  description: string
  status: WorkspaceStatus
  ownerId: string
  environment: string
  createdAt: string
  updatedAt: string
}

export interface Capability {
  id: string
  name: string
  description: string
  ownerScope: 'CORE' | 'WORKSPACE'
  workspaceId: string | null
  riskLevel: RiskLevel
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  status: CapabilityStatus
  createdAt: string
  updatedAt: string
}

export interface Policy {
  id: string
  name: string
  workspaceId: string
  subject: string
  resource: string
  action: string
  scope: string
  effect: PolicyEffect
  approvalRequired: boolean
  status: PolicyStatus
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string
  status: TaskStatus
  capabilityId: string | null
  credentialRef: string | null
  createdAt: string
  updatedAt: string
}

export interface Run {
  id: string
  taskId: string
  workspaceId: string
  status: RunStatus
  attempt: number
  idempotencyKey: string | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
  retryableErrors: string[]
}

export interface TaskClassification {
  taskId: string
  workspaceId: string
  taskType: string
  requiredCapabilityIds: string[]
  riskLevel: RiskLevel
  constraints: Record<string, unknown>
}

export interface ExecutionStep {
  id: string
  planId: string
  capabilityId: string
  input: Record<string, unknown>
  inputRef: string | null
  dependsOn: string[]
  approvalRequired: boolean
  approvalStatus: ApprovalStatus | null
  approvalRef: string | null
  timeoutSeconds: number
  retryPolicy: RetryPolicy
  expectedOutput: Record<string, unknown>
  status: StepStatus
  attempts: number
  createdAt: string
  updatedAt: string
}

export interface ExecutionPlan {
  id: string
  taskId: string
  workspaceId: string
  steps: ExecutionStep[]
  status: PlanStatus
  overallTimeoutSeconds: number
  createdAt: string
  updatedAt: string
}

export interface CapabilityInvocation {
  capabilityId: string
  workspaceId: string
  taskId: string
  runId: string
  input: Record<string, unknown>
  credentialRef: string | null
  policyContext: {
    actor: Actor
    policyId: string | null
    approvalRef: string | null
    idempotencyKey: string
  }
}

export interface ExecutionResult {
  id: string
  taskId: string
  runId: string
  workspaceId: string
  stepId: string
  status: 'SUCCEEDED' | 'FAILED'
  output: Record<string, unknown> | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

export interface IdempotencyRecord {
  key: string
  workspaceId: string
  capabilityId: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  resultId: string | null
  createdAt: string
  updatedAt: string
}

export type EventType =
  | 'WORKSPACE_CREATED' | 'WORKSPACE_UPDATED' | 'WORKSPACE_SUSPENDED' | 'WORKSPACE_ARCHIVED'
  | 'CAPABILITY_CREATED' | 'CAPABILITY_UPDATED' | 'CAPABILITY_DISABLED'
  | 'POLICY_CREATED' | 'POLICY_UPDATED'
  | 'TASK_CREATED' | 'TASK_ACCEPTED' | 'TASK_CLASSIFIED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'TASK_BLOCKED' | 'TASK_CANCELLED'
  | 'PLAN_CREATED' | 'CAPABILITY_SELECTED' | 'POLICY_EVALUATED'
  | 'APPROVAL_REQUESTED' | 'APPROVAL_GRANTED' | 'APPROVAL_DENIED'
  | 'DISPATCH_STARTED' | 'EXECUTION_STARTED' | 'EXECUTION_COMPLETED' | 'EXECUTION_FAILED' | 'RETRY_SCHEDULED' | 'RESULT_STORED'
  | 'RUN_CREATED' | 'RUN_STARTED' | 'RUN_COMPLETED' | 'RUN_FAILED' | 'RUN_CANCELLED'
  | 'AUTHORIZATION_GRANTED' | 'AUTHORIZATION_DENIED'

export interface AuditEvent {
  id: string
  type: EventType
  actor: Actor
  workspaceId: string | null
  resourceType: string
  resourceId: string
  timestamp: string
  metadata: Record<string, unknown>
}

export type AuthorizationDecision = {
  effect: PolicyEffect
  reason: string
  policyId: string | null
  approvalRequired: boolean
}
