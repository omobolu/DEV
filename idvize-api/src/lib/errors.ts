/**
 * Custom error classes for the idvize API.
 * All API errors extend AppError which carries a status code and error code.
 */

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: Record<string, unknown>

  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_REQUIRED') {
    super(message, 401, code)
    this.name = 'AuthenticationError'
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor() {
    super('Token has expired — please sign in again', 'TOKEN_EXPIRED')
    this.name = 'TokenExpiredError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', details)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`
    super(msg, 404, 'NOT_FOUND', { resource, id })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details)
    this.name = 'ConflictError'
  }
}
