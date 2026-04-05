/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to the Express error handler middleware.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
