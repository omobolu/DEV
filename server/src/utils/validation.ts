/**
 * Input validation utilities for API endpoints.
 * Prevents SQL injection via parameterized queries, but
 * these functions sanitize and validate business-level constraints.
 */

const MAX_TEXT_LENGTH = 500
const MAX_NAME_LENGTH = 200

export function sanitizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

export function requireString(value: unknown, fieldName: string): string {
  if (value === null || value === undefined || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required and must be a non-empty string`)
  }
  return value.trim().slice(0, MAX_NAME_LENGTH)
}

export function validateEnum<T extends string>(value: unknown, allowed: T[], fieldName: string): T {
  const str = sanitizeString(value)
  if (!str || !allowed.includes(str as T)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`)
  }
  return str as T
}

export function validateBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return false
}

export class ValidationError extends Error {
  statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
