import pool from '../db/pool.js'
import crypto from 'crypto'

export interface AuditEntry {
  userId?: string
  tenantId: string
  action: 'login' | 'logout' | 'create' | 'read' | 'update' | 'delete'
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export async function recordAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const id = `audit-${crypto.randomUUID().slice(0, 12)}`
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, tenant_id, action, resource, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        entry.userId || null,
        entry.tenantId,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null,
      ]
    )
  } catch (err) {
    // Audit logging should not break the request
    console.error('[AUDIT] Failed to record audit log:', err)
  }
}
