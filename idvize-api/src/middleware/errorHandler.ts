import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId
  const timestamp = new Date().toISOString()

  if (err instanceof AppError) {
    // Known application error — log at warn level (expected)
    logger.warn(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      requestId,
      method: req.method,
      path: req.path,
      ...(err.details ?? {}),
    })

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
      requestId,
      timestamp,
    })
    return
  }

  // Unknown error — log full stack at error level
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId,
    method: req.method,
    path: req.path,
  })

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp,
  })
}
