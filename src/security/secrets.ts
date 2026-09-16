import { invalid } from '../domain/errors'

const secretKey = /(^|_)(secret|password|passwd|token|api[_-]?key|private[_-]?key|session|cookie)($|_)/i

export function assertNoPlaintextSecrets(value: unknown, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPlaintextSecrets(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const current = `${path}.${key}`
    if (secretKey.test(key)) {
      if (key === 'credentialRef' || key === 'credential_ref') {
        if (item !== null && (typeof item !== 'string' || !/^secret:\/\/workspace\/[a-z0-9-]+\/[a-zA-Z0-9._-]+$/.test(item))) {
          throw invalid(`${current} must be a secret://workspace/<workspace>/<credential> reference`)
        }
      } else if (item !== undefined && item !== null && item !== '') {
        throw invalid(`${current} appears to contain a plaintext secret`)
      }
    }
    assertNoPlaintextSecrets(item, current)
  }
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    secretKey.test(key) && key !== 'credentialRef' && key !== 'credential_ref' ? '[REDACTED]' : redactSecrets(item),
  ]))
}
