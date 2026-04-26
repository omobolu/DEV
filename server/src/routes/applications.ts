import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/tenant.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'
import { recordAuditLog } from '../utils/audit.js'
import { requireString, sanitizeString, validateEnum, validateBoolean, ValidationError } from '../utils/validation.js'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth)

/** GET /api/applications */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, criticality, description, owner, business_unit, auth_method,
              data_classification, sox_applicable, created_at
       FROM applications WHERE tenant_id = $1 ORDER BY name`,
      [req.tenantId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[APPS] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** GET /api/applications/:id */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM applications WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' })
      return
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('[APPS] Get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/applications */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const name = requireString(req.body.name, 'name')
    const criticality = validateEnum(req.body.criticality || 'medium', ['low', 'medium', 'high', 'critical'], 'criticality')
    const description = sanitizeString(req.body.description)
    const owner = sanitizeString(req.body.owner)
    const business_unit = sanitizeString(req.body.business_unit)
    const auth_method = sanitizeString(req.body.auth_method)
    const data_classification = sanitizeString(req.body.data_classification)
    const sox_applicable = validateBoolean(req.body.sox_applicable)

    const id = `app-${crypto.randomUUID().slice(0, 8)}`
    const result = await pool.query(
      `INSERT INTO applications (id, name, criticality, description, owner, business_unit, auth_method, data_classification, sox_applicable, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name, criticality, description, owner, business_unit, auth_method, data_classification, sox_applicable, req.tenantId]
    )

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'create',
      resource: 'application',
      resourceId: id,
      details: { name, criticality },
      ipAddress: req.ip,
    })

    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    console.error('[APPS] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** DELETE /api/applications/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM applications WHERE id = $1 AND tenant_id = $2 RETURNING id, name`,
      [req.params.id, req.tenantId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' })
      return
    }

    await recordAuditLog({
      userId: req.userId,
      tenantId: req.tenantId!,
      action: 'delete',
      resource: 'application',
      resourceId: req.params.id,
      details: { name: result.rows[0].name },
      ipAddress: req.ip,
    })

    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    console.error('[APPS] Delete error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
