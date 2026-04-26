import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/tenant.js'
import type { AuthenticatedRequest } from '../middleware/tenant.js'

const router = Router()

router.use(requireAuth)

/** GET /api/dashboard — aggregated dashboard data from live database */
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId
  try {
    // Run all queries in parallel
    const [
      appsResult,
      controlsResult,
      controlSummary,
      assessmentSummary,
      riskResult,
      riskBySeverity,
      metricsResult,
    ] = await Promise.all([
      // Total applications
      pool.query(`SELECT COUNT(*) as count FROM applications WHERE tenant_id = $1`, [tenantId]),
      // Total controls
      pool.query(`SELECT COUNT(*) as count FROM iam_controls WHERE tenant_id = $1`, [tenantId]),
      // Controls by status
      pool.query(
        `SELECT status, COUNT(*) as count FROM iam_controls WHERE tenant_id = $1 GROUP BY status`,
        [tenantId]
      ),
      // Assessments by status
      pool.query(
        `SELECT status, COUNT(*) as count FROM control_assessments WHERE tenant_id = $1 GROUP BY status`,
        [tenantId]
      ),
      // Total risk findings
      pool.query(
        `SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'open') as open_count FROM risk_findings WHERE tenant_id = $1`,
        [tenantId]
      ),
      // Risks by severity
      pool.query(
        `SELECT severity, COUNT(*) as count FROM risk_findings WHERE tenant_id = $1 AND status = 'open' GROUP BY severity`,
        [tenantId]
      ),
      // Stored dashboard metrics
      pool.query(
        `SELECT metric_key, metric_value FROM dashboard_metrics WHERE tenant_id = $1`,
        [tenantId]
      ),
    ])

    // Build metrics map
    const storedMetrics: Record<string, unknown> = {}
    for (const row of metricsResult.rows) {
      storedMetrics[row.metric_key] = row.metric_value
    }

    // Build control status map
    const controlStatusMap: Record<string, number> = { OK: 0, ATTN: 0, GAP: 0 }
    for (const row of controlSummary.rows) {
      controlStatusMap[row.status] = parseInt(row.count)
    }

    // Build assessment status map
    const assessmentStatusMap: Record<string, number> = { OK: 0, ATTN: 0, GAP: 0 }
    for (const row of assessmentSummary.rows) {
      assessmentStatusMap[row.status] = parseInt(row.count)
    }

    // Build risk severity map
    const riskSeverityMap: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const row of riskBySeverity.rows) {
      riskSeverityMap[row.severity] = parseInt(row.count)
    }

    res.json({
      totalApplications: parseInt(appsResult.rows[0].count),
      totalControls: parseInt(controlsResult.rows[0].count),
      controlsByStatus: controlStatusMap,
      assessmentsByStatus: assessmentStatusMap,
      totalRiskFindings: parseInt(riskResult.rows[0].count),
      openRiskFindings: parseInt(riskResult.rows[0].open_count),
      risksBySeverity: riskSeverityMap,
      metrics: storedMetrics,
    })
  } catch (err) {
    console.error('[DASHBOARD] Error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** GET /api/dashboard/metrics — stored metrics only */
router.get('/metrics', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT metric_key, metric_value, updated_at FROM dashboard_metrics WHERE tenant_id = $1`,
      [req.tenantId]
    )
    const metrics: Record<string, unknown> = {}
    for (const row of result.rows) {
      metrics[row.metric_key] = row.metric_value
    }
    res.json(metrics)
  } catch (err) {
    console.error('[DASHBOARD] Metrics error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
