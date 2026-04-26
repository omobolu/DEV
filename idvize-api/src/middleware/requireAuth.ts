/**
 * requireAuth Middleware
 *
 * Validates the Authorization: Bearer <token> header.
 * Decodes and verifies the JWT, attaches TokenClaims to req.user
 * and tenantId to req.tenantId.
 * Returns 401 with specific error codes for different failure types.
 *
 * In production mode, revalidates user and tenant status from PostgreSQL
 * on each request rather than relying solely on the startup-loaded cache.
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { TokenClaims } from '../modules/security/security.types'
import { authService } from '../modules/security/auth/auth.service'
import { logger } from '../lib/logger'
import { getSeedMode } from '../config/seed-mode'
import pool from '../db/pool'

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

/**
 * In production mode, revalidate user + tenant status directly from PostgreSQL.
 * Catches deactivated users and suspended tenants between token issuance and request.
 * Returns null if validation passes, or an error string if the request should be rejected.
 */
async function revalidateFromPg(claims: TokenClaims): Promise<string | null> {
  if (getSeedMode() !== 'production') return null;

  try {
    const [userResult, tenantResult] = await Promise.all([
      pool.query(
        'SELECT status FROM users WHERE user_id = $1 AND tenant_id = $2',
        [claims.sub, claims.tenantId]
      ),
      pool.query(
        'SELECT status FROM tenants WHERE tenant_id = $1',
        [claims.tenantId]
      ),
    ]);

    if (userResult.rows.length === 0) return 'User no longer exists';
    if (userResult.rows[0].status !== 'active') return `User account is ${userResult.rows[0].status}`;
    if (tenantResult.rows.length === 0) return 'Tenant no longer exists';
    if (tenantResult.rows[0].status !== 'active') return `Tenant is ${tenantResult.rows[0].status}`;

    return null;
  } catch (err) {
    logger.error('Production PG revalidation failed — denying request (fail closed)', {
      userId: claims.sub, tenantId: claims.tenantId, error: (err as Error).message,
    });
    return 'Database unavailable — cannot verify account status';
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

    // Production: revalidate user + tenant status from PG on every request
    const revalError = await revalidateFromPg(claims);
    if (revalError) {
      logger.warn('Production revalidation denied request', {
        userId: claims.sub, tenantId: claims.tenantId, reason: revalError,
      });
      res.status(403).json({
        success: false,
        error: revalError,
        code: 'ACCOUNT_REVALIDATION_FAILED',
        requestId: req.requestId,
        timestamp,
      });
      return;
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
