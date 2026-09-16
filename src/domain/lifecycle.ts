import type { RunStatus, TaskStatus } from './models'

const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ['CLASSIFIED', 'BLOCKED', 'CANCELLED'],
  CLASSIFIED: ['PLANNED', 'DELEGATED', 'BLOCKED', 'CANCELLED'],
  PLANNED: ['AUTHORIZED', 'BLOCKED', 'CANCELLED'],
  AUTHORIZED: ['DISPATCHED', 'BLOCKED', 'CANCELLED'],
  DELEGATED: ['DISPATCHED', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  DISPATCHED: ['RUNNING', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  RETRYING: ['DISPATCHED', 'RUNNING', 'BLOCKED', 'FAILED', 'CANCELLED'],
  BLOCKED: ['PENDING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
}

const runTransitions: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ['DISPATCHED', 'RUNNING', 'BLOCKED', 'CANCELLED'],
  DISPATCHED: ['RUNNING', 'BLOCKED', 'CANCELLED'],
  RUNNING: ['RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  RETRYING: ['RUNNING', 'BLOCKED', 'FAILED', 'CANCELLED'],
  BLOCKED: ['CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
}

export const canTransitionTask = (from: TaskStatus, to: TaskStatus) => taskTransitions[from].includes(to)
export const canTransitionRun = (from: RunStatus, to: RunStatus) => runTransitions[from].includes(to)
