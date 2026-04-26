import type { Request, Response, NextFunction } from 'express'
import pool from '../db/pool.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  tenantId?: string
  userRole?: string
}

/**
 * Middleware that validates the session and attaches tenant context.
 * All tenant-scoped routes must use this middleware.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.headers['x-session-id'] as string

  if (!sessionId) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.tenant_id, s.expires_at, s.active, u.role
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.active = true AND s.expires_at > NOW()`,
      [sessionId]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }

    const session = result.rows[0]
    req.userId = session.user_id
    req.tenantId = session.tenant_id
    req.userRole = session.role
    next()
  } catch (err) {
    console.error('[AUTH] Session validation error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
