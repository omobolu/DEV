import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/tenant.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'
import { recordAuditLog } from '../utils/audit.js'
import { requireString, sanitizeString, validateEnum, ValidationError } from '../utils/validation.js'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth)

const CONTROL_TYPES = ['MFA', 'SSO', 'PAM', 'RBAC', 'PROVISIONING', 'CERTIFICATION', 'LIFECYCLE'] as const
const CONTROL_STATUSES = ['OK', 'ATTN', 'GAP'] as const

/** GET /api/controls */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.application_id, c.control_type, c.status, c.details, c.created_at,
              a.name as application_name
       FROM iam_controls c
       JOIN applications a ON c.application_id = a.id
       WHERE c.tenant_id = $1
       ORDER BY a.name, c.control_type`,
      [req.tenantId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[CONTROLS] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/controls */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const application_id = requireString(req.body.application_id, 'application_id')
    const control_type = validateEnum(req.body.control_type, [...CONTROL_TYPES], 'control_type')
    const status = validateEnum(req.body.status, [...CONTROL_STATUSES], 'status')
    const details = sanitizeString(req.body.details)

    // Verify application belongs to tenant
    const appCheck = await pool.query(
      `SELECT id FROM applications WHERE id = $1 AND tenant_id = $2`,
      [application_id, req.tenantId]
    )
    if (appCheck.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' })
      return
    }

    const id = `ctrl-${crypto.randomUUID().slice(0, 8)}`
    const result = await pool.query(
      `INSERT INTO iam_controls (id, application_id, control_type, status, details, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, application_id, control_type, status, details, req.tenantId]
    )

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'create',
      resource: 'iam_control',
      resourceId: id,
      details: { application_id, control_type, status },
      ipAddress: req.ip,
    })

    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[CONTROLS] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** DELETE /api/controls/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM iam_controls WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.tenantId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Control not found' })
      return
    }

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'delete',
      resource: 'iam_control',
      resourceId: req.params.id,
      ipAddress: req.ip,
    })

    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    console.error('[CONTROLS] Delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
