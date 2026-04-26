import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/tenant.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'
import { recordAuditLog } from '../utils/audit.js'
import { requireString, sanitizeString, validateEnum, ValidationError } from '../utils/validation.js'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth)

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

/** GET /api/risks */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT rf.id, rf.application_id, rf.category, rf.description, rf.severity,
              rf.status, rf.created_at, rf.resolved_at, a.name as application_name
       FROM risk_findings rf
       LEFT JOIN applications a ON rf.application_id = a.id
       WHERE rf.tenant_id = $1
       ORDER BY CASE rf.severity
         WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
       END, rf.created_at DESC`,
      [req.tenantId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[RISKS] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/risks */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const category = requireString(req.body.category, 'category')
    const description = requireString(req.body.description, 'description')
    const severity = validateEnum(req.body.severity, [...SEVERITIES], 'severity')
    const application_id = sanitizeString(req.body.application_id)

    const id = `risk-${crypto.randomUUID().slice(0, 8)}`
    const result = await pool.query(
      `INSERT INTO risk_findings (id, application_id, category, description, severity, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, application_id || null, category, description, severity, req.tenantId]
    )

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'create',
      resource: 'risk_finding',
      resourceId: id,
      details: { category, severity },
      ipAddress: req.ip,
    })

    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[RISKS] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** DELETE /api/risks/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM risk_findings WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.tenantId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Risk finding not found' })
      return
    }

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'delete',
      resource: 'risk_finding',
      resourceId: req.params.id,
      ipAddress: req.ip,
    })

    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    console.error('[RISKS] Delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
