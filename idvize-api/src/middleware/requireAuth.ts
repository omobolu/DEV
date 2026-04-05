/**
 * requireAuth Middleware
 *
 * Validates the Authorization: Bearer <token> header.
 * Decodes and verifies the JWT, attaches TokenClaims to req.user
 * and tenantId to req.tenantId.
 * Returns 401 with specific error codes for different failure types.
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { TokenClaims } from '../modules/security/security.types'
import { authService } from '../modules/security/auth/auth.service'
import { logger } from '../lib/logger'

// Extend Express Request to carry the decoded token claims and tenant context
declare global {
  namespace Express {
    interface Request {
      user?: TokenClaims
      requestId?: string
      tenantId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const timestamp = new Date().toISOString()
  const authHeader = req.headers['authorization']

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required — provide Authorization: Bearer <token>',
      code: 'AUTH_REQUIRED',
      requestId: req.requestId,
      timestamp,
    })
    return
  }

  const token = authHeader.slice(7)

  // Try verifying with detailed error classification
  try {
    const claims = await authService.verifyToken(token)
    if (!claims) {
      res.status(401).json({
        success: false,
        error: 'Token is invalid',
        code: 'TOKEN_INVALID',
        requestId: req.requestId,
        timestamp,
      })
      return
    }

    req.user     = claims
    req.tenantId = claims.tenantId
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.info('Token expired', { requestId: req.requestId, path: req.path })
      res.status(401).json({
        success: false,
        error: 'Token has expired — please sign in again',
        code: 'TOKEN_EXPIRED',
        requestId: req.requestId,
        timestamp,
      })
    } else {
      logger.warn('Token verification failed', { requestId: req.requestId, error: (err as Error).message })
      res.status(401).json({
        success: false,
        error: 'Token is invalid',
        code: 'TOKEN_INVALID',
        requestId: req.requestId,
        timestamp,
      })
    }
  }
}
