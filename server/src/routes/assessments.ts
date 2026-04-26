import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/tenant.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'
import { recordAuditLog } from '../utils/audit.js'
import { requireString, sanitizeString, validateEnum, ValidationError } from '../utils/validation.js'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth)

const ASSESSMENT_STATUSES = ['OK', 'ATTN', 'GAP'] as const

/** GET /api/assessments */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT ca.id, ca.application_id, ca.control_type, ca.status, ca.assessed_by,
              ca.assessed_at, ca.notes, ca.created_at, a.name as application_name
       FROM control_assessments ca
       JOIN applications a ON ca.application_id = a.id
       WHERE ca.tenant_id = $1
       ORDER BY ca.assessed_at DESC`,
      [req.tenantId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[ASSESSMENTS] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/assessments */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const application_id = requireString(req.body.application_id, 'application_id')
    const control_type = requireString(req.body.control_type, 'control_type')
    const status = validateEnum(req.body.status, [...ASSESSMENT_STATUSES], 'status')
    const assessed_by = sanitizeString(req.body.assessed_by)
    const notes = sanitizeString(req.body.notes)

    const appCheck = await pool.query(
      `SELECT id FROM applications WHERE id = $1 AND tenant_id = $2`,
      [application_id, req.tenantId]
    )
    if (appCheck.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' })
      return
    }

    const id = `assess-${crypto.randomUUID().slice(0, 8)}`
    const result = await pool.query(
      `INSERT INTO control_assessments (id, application_id, control_type, status, assessed_by, notes, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, application_id, control_type, status, assessed_by, notes, req.tenantId]
    )

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'create',
      resource: 'control_assessment',
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
    console.error('[ASSESSMENTS] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** DELETE /api/assessments/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM control_assessments WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.tenantId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Assessment not found' })
      return
    }

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'delete',
      resource: 'control_assessment',
      resourceId: req.params.id,
      ipAddress: req.ip,
    })

    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    console.error('[ASSESSMENTS] Delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
