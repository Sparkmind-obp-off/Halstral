import type { CapabilityInvocation } from '../domain/models'
import type { AdapterResult, ExecutionAdapter } from '../ports/execution-adapter'

/**
 * Deliberately bounded Phase 2 adapter. It performs deterministic internal
 * transformations only; it cannot execute code, access the network, or resolve secrets.
 */
export class InternalExecutionAdapter implements ExecutionAdapter {
  readonly id = 'internal.safe-v1'
  readonly capabilityNames = ['internal.echo', 'internal.analyze', 'generate.document'] as const
  readonly supportsIdempotency = true

  async execute(invocation: CapabilityInvocation, signal: AbortSignal): Promise<AdapterResult> {
    if (signal.aborted) throw new DOMException('Execution aborted', 'AbortError')
    return {
      output: {
        capabilityId: invocation.capabilityId,
        taskId: invocation.taskId,
        workspaceId: invocation.workspaceId,
        acceptedInput: invocation.input,
        executedBy: this.id,
      },
    }
  }
}
