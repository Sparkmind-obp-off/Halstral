export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message)
    this.name = 'DomainError'
  }
}

export const notFound = (resource: string) => new DomainError('NOT_FOUND', `${resource} not found`, 404)
export const conflict = (message: string) => new DomainError('CONFLICT', message, 409)
export const forbidden = (message: string) => new DomainError('FORBIDDEN', message, 403)
export const invalid = (message: string) => new DomainError('VALIDATION_ERROR', message, 422)
