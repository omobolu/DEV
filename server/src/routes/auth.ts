import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/tenant.js'
import { recordAuditLog } from '../utils/audit.js'
import { requireString, ValidationError } from '../utils/validation.js'
import crypto from 'crypto'

const router = Router()

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const username = requireString(req.body.username, 'username')
    const password = requireString(req.body.password, 'password')

    const userResult = await pool.query(
      `SELECT id, username, password, display_name, email, role, department, title, tenant_id
       FROM users WHERE username = $1 AND active = true`,
      [username]
    )

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const user = userResult.rows[0]

    // Verify bcrypt-hashed password
    const passwordValid = await bcrypt.compare(password, user.password)
    if (!passwordValid) {
      await recordAuditLog({
        tenantId: user.tenant_id,
        action: 'login',
        resource: 'auth',
        details: { username, success: false, reason: 'Invalid password' },
        ipAddress: req.ip,
      })
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Create session
    const sessionId = `sess-${crypto.randomUUID()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    await pool.query(
      `INSERT INTO sessions (id, user_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, user.tenant_id, expiresAt.toISOString()]
    )

    // Update last_login_at
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])

    // Get tenant info
    const tenantResult = await pool.query(`SELECT id, name FROM tenants WHERE id = $1`, [user.tenant_id])
    const tenant = tenantResult.rows[0]

    // Audit log
    await recordAuditLog({
      userId: user.id,
      tenantId: user.tenant_id,
      action: 'login',
      resource: 'auth',
      details: { username, success: true },
      ipAddress: req.ip,
    })

    res.json({
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        department: user.department,
        title: user.title,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[AUTH] Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/auth/logout */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  const sessionId = req.headers['x-session-id'] as string
  try {
    await pool.query(`UPDATE sessions SET active = false WHERE id = $1`, [sessionId])

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'logout',
      resource: 'auth',
      ipAddress: req.ip,
    })

    res.json({ success: true })
  } catch (err) {
    console.error('[AUTH] Logout error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** GET /api/auth/session */
router.get('/session', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, username, display_name, email, role, department, title, tenant_id
       FROM users WHERE id = $1`,
      [req.userId]
    )
    const user = userResult.rows[0]
    const tenantResult = await pool.query(`SELECT id, name FROM tenants WHERE id = $1`, [req.tenantId])
    const tenant = tenantResult.rows[0]

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        department: user.department,
        title: user.title,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    })
  } catch (err) {
    console.error('[AUTH] Session fetch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
