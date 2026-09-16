export const WORKSPACE_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const
export const CAPABILITY_STATUSES = ['ACTIVE', 'DISABLED', 'DEPRECATED'] as const
export const POLICY_EFFECTS = ['ALLOW', 'DENY'] as const
export const POLICY_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const TASK_STATUSES = ['PENDING', 'CLASSIFIED', 'DELEGATED', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
export const RUN_STATUSES = ['CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const

export type WorkspaceStatus = typeof WORKSPACE_STATUSES[number]
export type CapabilityStatus = typeof CAPABILITY_STATUSES[number]
export type PolicyEffect = typeof POLICY_EFFECTS[number]
export type PolicyStatus = typeof POLICY_STATUSES[number]
export type TaskStatus = typeof TASK_STATUSES[number]
export type RunStatus = typeof RUN_STATUSES[number]

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
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
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
  startedAt: string | null
  completedAt: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type EventType =
  | 'WORKSPACE_CREATED' | 'WORKSPACE_UPDATED' | 'WORKSPACE_SUSPENDED' | 'WORKSPACE_ARCHIVED'
  | 'CAPABILITY_CREATED' | 'CAPABILITY_UPDATED' | 'CAPABILITY_DISABLED'
  | 'POLICY_CREATED' | 'POLICY_UPDATED'
  | 'TASK_CREATED' | 'TASK_UPDATED'
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
