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
import { authRepository } from '../modules/security/auth/auth.repository'
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
 * Also refreshes the user's roles/status in the in-memory cache so that
 * authzService.check() uses current PG data (not stale startup-loaded cache).
 * Returns null if validation passes, or { status, error } if the request should be rejected.
 */
async function revalidateFromPg(claims: TokenClaims): Promise<{ status: number; error: string } | null> {
  if (getSeedMode() !== 'production') return null;

  try {
    const [userResult, tenantResult] = await Promise.all([
      pool.query(
        'SELECT user_id, tenant_id, username, display_name, first_name, last_name, email, department, title, roles, groups, status, auth_provider, mfa_enrolled, password_hash, attributes, last_login_at, created_at, updated_at FROM users WHERE user_id = $1 AND tenant_id = $2',
        [claims.sub, claims.tenantId]
      ),
      pool.query(
        'SELECT status FROM tenants WHERE tenant_id = $1',
        [claims.tenantId]
      ),
    ]);

    if (userResult.rows.length === 0) return { status: 403, error: 'User no longer exists' };
    const userRow = userResult.rows[0];
    if (userRow.status !== 'active') return { status: 403, error: `User account is ${userRow.status}` };
    if (tenantResult.rows.length === 0) return { status: 403, error: 'Tenant no longer exists' };
    if (tenantResult.rows[0].status !== 'active') return { status: 403, error: `Tenant is ${tenantResult.rows[0].status}` };

    // Refresh in-memory cache with current PG roles/status so authzService
    // uses fresh data instead of stale startup-loaded values.
    const roles = typeof userRow.roles === 'string' ? JSON.parse(userRow.roles) : userRow.roles;
    const groups = typeof userRow.groups === 'string' ? JSON.parse(userRow.groups) : userRow.groups;
    const attributes = typeof userRow.attributes === 'string' ? JSON.parse(userRow.attributes) : userRow.attributes;
    authRepository.save(claims.tenantId, {
      userId: userRow.user_id,
      tenantId: userRow.tenant_id,
      username: userRow.username,
      displayName: userRow.display_name,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      email: userRow.email,
      department: userRow.department,
      title: userRow.title,
      roles,
      groups,
      status: userRow.status,
      authProvider: userRow.auth_provider,
      mfaEnrolled: userRow.mfa_enrolled,
      passwordHash: userRow.password_hash,
      attributes,
      lastLoginAt: userRow.last_login_at ? new Date(userRow.last_login_at).toISOString() : undefined,
      createdAt: new Date(userRow.created_at).toISOString(),
      updatedAt: new Date(userRow.updated_at).toISOString(),
    });

    return null;
  } catch (err) {
    logger.error('Production PG revalidation failed — denying request (fail closed)', {
      userId: claims.sub, tenantId: claims.tenantId, error: (err as Error).message,
    });
    return { status: 503, error: 'Database unavailable — cannot verify account status' };
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
    const revalResult = await revalidateFromPg(claims);
    if (revalResult) {
      logger.warn('Production revalidation denied request', {
        userId: claims.sub, tenantId: claims.tenantId, reason: revalResult.error,
      });
      res.status(revalResult.status).json({
        success: false,
        error: revalResult.error,
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
