import type { CapabilityInvocation } from '../domain/models'

export type AdapterFailureKind = 'TRANSIENT' | 'INVALID_INPUT' | 'AUTHORIZATION' | 'CREDENTIAL' | 'EXTERNAL_REFUSAL' | 'TIMEOUT' | 'UNSAFE_IDEMPOTENCY'

export class AdapterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly kind: AdapterFailureKind,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'AdapterError'
  }
}

export interface AdapterResult {
  output: Record<string, unknown>
}

export interface ExecutionAdapter {
  readonly id: string
  readonly capabilityNames: readonly string[]
  readonly supportsIdempotency: boolean
  execute(invocation: CapabilityInvocation, signal: AbortSignal): Promise<AdapterResult>
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, ExecutionAdapter>()

  register(adapter: ExecutionAdapter): void {
    for (const capabilityName of adapter.capabilityNames) this.adapters.set(capabilityName, adapter)
  }

  resolve(capabilityName: string): ExecutionAdapter | null {
    return this.adapters.get(capabilityName) ?? null
  }
}
