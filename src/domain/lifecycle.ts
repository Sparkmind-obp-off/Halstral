import type { RunStatus, TaskStatus } from './models'

const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ['CLASSIFIED', 'BLOCKED', 'CANCELLED'],
  CLASSIFIED: ['DELEGATED', 'BLOCKED', 'CANCELLED'],
  DELEGATED: ['BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  BLOCKED: ['PENDING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
}

const runTransitions: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
}

export const canTransitionTask = (from: TaskStatus, to: TaskStatus) => taskTransitions[from].includes(to)
export const canTransitionRun = (from: RunStatus, to: RunStatus) => runTransitions[from].includes(to)
