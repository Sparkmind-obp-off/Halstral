import type { Actor, AuthorizationDecision, Policy } from '../domain/models'

type EvaluationInput = {
  actor: Actor
  ownerId: string
  workspaceId: string | null
  resource: string
  action: string
  policies: Policy[]
}

const matches = (rule: string, value: string | null) => rule === '*' || rule === value

export function evaluateAuthorization(input: EvaluationInput): AuthorizationDecision {
  if (input.actor.type === 'OWNER' && input.actor.id === input.ownerId) {
    return { effect: 'ALLOW', reason: 'OWNER_AUTHORITY', policyId: null, approvalRequired: false }
  }

  const applicable = input.policies.filter((policy) =>
    policy.status === 'ACTIVE' &&
    matches(policy.subject, input.actor.id) &&
    matches(policy.resource, input.resource) &&
    matches(policy.action, input.action) &&
    matches(policy.scope, input.workspaceId),
  )

  const denied = applicable.find((policy) => policy.effect === 'DENY')
  if (denied) return { effect: 'DENY', reason: 'EXPLICIT_DENY', policyId: denied.id, approvalRequired: denied.approvalRequired }

  const allowed = applicable.find((policy) => policy.effect === 'ALLOW')
  if (allowed) return { effect: 'ALLOW', reason: 'EXPLICIT_ALLOW', policyId: allowed.id, approvalRequired: allowed.approvalRequired }

  return { effect: 'DENY', reason: 'DEFAULT_DENY', policyId: null, approvalRequired: false }
}
