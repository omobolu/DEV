/**
 * Agent Execution Repository — PostgreSQL-backed persistent storage.
 *
 * Replaces in-memory Maps for sessions, approvals, and evidence.
 * All queries use parameterized SQL ($1, $2, etc.) — no string interpolation.
 * tenantId MUST come from JWT context, never from request input.
 * Fails closed: PG errors propagate as exceptions (controller returns 503).
 */

import pool from '../../db/pool';
import type {
  ExecutionSession,
  ExecutionSessionStatus,
  ExecutionApproval,
  EvidenceRecord,
  EvidenceType,
  SessionListFilters,
} from './agent-execution.types';

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function saveSession(session: ExecutionSession): Promise<void> {
  await pool.query(
    `INSERT INTO execution_sessions
       (session_id, tenant_id, agent_type, status, plan, credential_handles, created_by, error_message, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (session_id) DO UPDATE SET
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       credential_handles = EXCLUDED.credential_handles,
       error_message = EXCLUDED.error_message,
       updated_at = EXCLUDED.updated_at,
       completed_at = EXCLUDED.completed_at`,
    [
      session.sessionId,
      session.tenantId,
      session.agentType,
      session.status,
      JSON.stringify(session.plan ?? null),
      JSON.stringify(session.credentialHandles),
      session.createdBy,
      session.errorMessage ?? null,
      session.createdAt,
      session.updatedAt,
      session.completedAt ?? null,
    ],
  );
}

export async function getSession(tenantId: string, sessionId: string): Promise<ExecutionSession | undefined> {
  const { rows } = await pool.query(
    `SELECT s.*,
       COALESCE(
         (SELECT json_agg(a ORDER BY a.created_at)
          FROM execution_approvals a
          WHERE a.tenant_id = s.tenant_id AND a.session_id = s.session_id),
         '[]'::json
       ) AS approvals,
       COALESCE(
         (SELECT json_agg(e ORDER BY e.created_at)
          FROM execution_evidence e
          WHERE e.tenant_id = s.tenant_id AND e.session_id = s.session_id),
         '[]'::json
       ) AS evidence
     FROM execution_sessions s
     WHERE s.tenant_id = $1 AND s.session_id = $2`,
    [tenantId, sessionId],
  );
  if (rows.length === 0) return undefined;
  return rowToSession(rows[0]);
}

export async function listSessions(
  tenantId: string,
  filters?: SessionListFilters,
): Promise<ExecutionSession[]> {
  let query = `
    SELECT s.*,
      COALESCE(
        (SELECT json_agg(a ORDER BY a.created_at)
         FROM execution_approvals a
         WHERE a.tenant_id = s.tenant_id AND a.session_id = s.session_id),
        '[]'::json
      ) AS approvals,
      COALESCE(
        (SELECT json_agg(e ORDER BY e.created_at)
         FROM execution_evidence e
         WHERE e.tenant_id = s.tenant_id AND e.session_id = s.session_id),
        '[]'::json
      ) AS evidence
    FROM execution_sessions s
    WHERE s.tenant_id = $1`;

  const params: unknown[] = [tenantId];

  if (filters?.status) {
    params.push(filters.status);
    query += ` AND s.status = $${params.length}`;
  }
  if (filters?.agentType) {
    params.push(filters.agentType);
    query += ` AND s.agent_type = $${params.length}`;
  }

  query += ` ORDER BY s.created_at DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    query += ` LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(query, params);
  return rows.map(rowToSession);
}

function rowToSession(row: Record<string, unknown>): ExecutionSession {
  const approvalRows = (row.approvals ?? []) as Record<string, unknown>[];
  const evidenceRows = (row.evidence ?? []) as Record<string, unknown>[];

  return {
    sessionId: row.session_id as string,
    tenantId: row.tenant_id as string,
    agentType: row.agent_type as ExecutionSession['agentType'],
    status: row.status as ExecutionSessionStatus,
    plan: row.plan as ExecutionSession['plan'],
    approvals: approvalRows.map(rowToApproval),
    evidence: evidenceRows.map(rowToEvidence),
    credentialHandles: (row.credential_handles ?? []) as string[],
    createdBy: row.created_by as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    completedAt: row.completed_at ? toISOString(row.completed_at) : undefined,
    errorMessage: row.error_message as string | undefined,
  };
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export async function saveApproval(tenantId: string, approval: ExecutionApproval): Promise<void> {
  await pool.query(
    `INSERT INTO execution_approvals
       (approval_id, session_id, tenant_id, role, approver_id, approver_name, status, required_by, comment, created_at, resolved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (approval_id) DO UPDATE SET
       approver_id = EXCLUDED.approver_id,
       approver_name = EXCLUDED.approver_name,
       status = EXCLUDED.status,
       comment = EXCLUDED.comment,
       resolved_at = EXCLUDED.resolved_at`,
    [
      approval.approvalId,
      approval.sessionId,
      tenantId,
      approval.role,
      approval.approverId ?? null,
      approval.approverName ?? null,
      approval.status,
      approval.requiredBy,
      approval.comment ?? null,
      approval.createdAt,
      approval.resolvedAt ?? null,
    ],
  );
}

export async function saveApprovals(tenantId: string, approvals: ExecutionApproval[]): Promise<void> {
  for (const a of approvals) {
    await saveApproval(tenantId, a);
  }
}

export async function getApproval(tenantId: string, approvalId: string): Promise<ExecutionApproval | undefined> {
  const { rows } = await pool.query(
    `SELECT * FROM execution_approvals WHERE tenant_id = $1 AND approval_id = $2`,
    [tenantId, approvalId],
  );
  if (rows.length === 0) return undefined;
  return rowToApproval(rows[0]);
}

export async function getSessionApprovals(tenantId: string, sessionId: string): Promise<ExecutionApproval[]> {
  const { rows } = await pool.query(
    `SELECT * FROM execution_approvals WHERE tenant_id = $1 AND session_id = $2 ORDER BY created_at`,
    [tenantId, sessionId],
  );
  return rows.map(rowToApproval);
}

export async function isFullyApproved(tenantId: string, sessionId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved_count
     FROM execution_approvals
     WHERE tenant_id = $1 AND session_id = $2`,
    [tenantId, sessionId],
  );
  const total = parseInt(rows[0].total, 10);
  const approved = parseInt(rows[0].approved_count, 10);
  return total > 0 && total === approved;
}

function rowToApproval(row: Record<string, unknown>): ExecutionApproval {
  return {
    approvalId: row.approval_id as string,
    sessionId: row.session_id as string,
    role: row.role as ExecutionApproval['role'],
    approverId: row.approver_id as string | undefined,
    approverName: row.approver_name as string | undefined,
    status: row.status as ExecutionApproval['status'],
    requiredBy: toISOString(row.required_by),
    comment: row.comment as string | undefined,
    createdAt: toISOString(row.created_at),
    resolvedAt: row.resolved_at ? toISOString(row.resolved_at) : undefined,
  };
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export async function saveEvidence(tenantId: string, record: EvidenceRecord): Promise<void> {
  await pool.query(
    `INSERT INTO execution_evidence
       (evidence_id, session_id, tenant_id, step_id, type, title, description, data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      record.evidenceId,
      record.sessionId,
      tenantId,
      record.stepId ?? null,
      record.type,
      record.title,
      record.description,
      JSON.stringify(record.data),
      record.createdAt,
    ],
  );
}

export async function getEvidenceBySession(tenantId: string, sessionId: string): Promise<EvidenceRecord[]> {
  const { rows } = await pool.query(
    `SELECT * FROM execution_evidence WHERE tenant_id = $1 AND session_id = $2 ORDER BY created_at`,
    [tenantId, sessionId],
  );
  return rows.map(rowToEvidence);
}

export async function getEvidenceById(tenantId: string, evidenceId: string): Promise<EvidenceRecord | undefined> {
  const { rows } = await pool.query(
    `SELECT * FROM execution_evidence WHERE tenant_id = $1 AND evidence_id = $2`,
    [tenantId, evidenceId],
  );
  if (rows.length === 0) return undefined;
  return rowToEvidence(rows[0]);
}

function rowToEvidence(row: Record<string, unknown>): EvidenceRecord {
  return {
    evidenceId: row.evidence_id as string,
    sessionId: row.session_id as string,
    stepId: row.step_id as string | undefined,
    type: row.type as EvidenceType,
    title: row.title as string,
    description: row.description as string,
    data: (row.data ?? {}) as Record<string, unknown>,
    createdAt: toISOString(row.created_at),
  };
}

// ── Application lookup (PG-backed, replaces in-memory) ────────────────────────

export async function getApplication(
  tenantId: string,
  applicationId: string,
): Promise<{ appId: string; name: string; tenantId: string } | undefined> {
  const { rows } = await pool.query(
    `SELECT app_id, name, tenant_id FROM applications WHERE tenant_id = $1 AND app_id = $2`,
    [tenantId, applicationId],
  );
  if (rows.length === 0) return undefined;
  return { appId: rows[0].app_id, name: rows[0].name, tenantId: rows[0].tenant_id };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISOString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}
