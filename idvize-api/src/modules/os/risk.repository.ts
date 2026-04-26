/**
 * Risk Repository — PostgreSQL-backed data access for the Top IAM Risk Engine.
 *
 * All queries use parameterized $1/$2 bindings.
 * tenantId is always a bound parameter, never interpolated.
 * No in-memory caches or fallbacks.
 */

import pool from '../../db/pool';
import type { IamPillar } from '../control/control.catalog';

// ── Types returned by repository queries ────────────────────────────────────

export interface AppRiskRow {
  appId: string;
  applicationName: string;
  tenantId: string;
  gapCount: number;
  attentionCount: number;
  drivers: DriverRow[];
}

export interface DriverRow {
  controlId: string;
  controlName: string;
  pillar: IamPillar;
  outcome: 'GAP' | 'ATTN';
}

class RiskRepository {
  /**
   * Fetch all applications for a tenant with their GAP/ATTN counts and drivers.
   * Single query — no N+1.
   * Returns raw rows; classification is done in the service layer.
   */
  async getPortfolioRisks(tenantId: string): Promise<AppRiskRow[]> {
    const { rows } = await pool.query<{
      app_id: string;
      app_name: string;
      tenant_id: string;
      gap_count: string;
      attention_count: string;
      drivers: DriverRow[] | null;
    }>(
      `SELECT
         a.app_id,
         a.name AS app_name,
         a.tenant_id,
         COALESCE(SUM(CASE WHEN ca.outcome = 'GAP'  THEN 1 ELSE 0 END), 0) AS gap_count,
         COALESCE(SUM(CASE WHEN ca.outcome = 'ATTN' THEN 1 ELSE 0 END), 0) AS attention_count,
         COALESCE(
           json_agg(
             json_build_object(
               'controlId',   ca.control_id,
               'controlName', ca.control_name,
               'pillar',      ca.pillar,
               'outcome',     ca.outcome
             )
           ) FILTER (WHERE ca.outcome IN ('GAP', 'ATTN')),
           '[]'::json
         ) AS drivers
       FROM applications a
       LEFT JOIN control_assessments ca
         ON ca.app_id = a.app_id
        AND ca.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1
         AND a.status = 'active'
       GROUP BY a.app_id, a.name, a.tenant_id`,
      [tenantId],
    );

    return rows.map(r => ({
      appId: r.app_id,
      applicationName: r.app_name,
      tenantId: r.tenant_id,
      gapCount: Number(r.gap_count),
      attentionCount: Number(r.attention_count),
      drivers: r.drivers ?? [],
    }));
  }

  /**
   * Fetch a single application's risk data by BOTH tenantId AND applicationId.
   * Returns undefined if the app doesn't belong to the tenant (cross-tenant → 404).
   */
  async getApplicationRisk(tenantId: string, applicationId: string): Promise<AppRiskRow | undefined> {
    const { rows } = await pool.query<{
      app_id: string;
      app_name: string;
      tenant_id: string;
      gap_count: string;
      attention_count: string;
      drivers: DriverRow[] | null;
    }>(
      `SELECT
         a.app_id,
         a.name AS app_name,
         a.tenant_id,
         COALESCE(SUM(CASE WHEN ca.outcome = 'GAP'  THEN 1 ELSE 0 END), 0) AS gap_count,
         COALESCE(SUM(CASE WHEN ca.outcome = 'ATTN' THEN 1 ELSE 0 END), 0) AS attention_count,
         COALESCE(
           json_agg(
             json_build_object(
               'controlId',   ca.control_id,
               'controlName', ca.control_name,
               'pillar',      ca.pillar,
               'outcome',     ca.outcome
             )
           ) FILTER (WHERE ca.outcome IN ('GAP', 'ATTN')),
           '[]'::json
         ) AS drivers
       FROM applications a
       LEFT JOIN control_assessments ca
         ON ca.app_id = a.app_id
        AND ca.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1
         AND a.app_id = $2
         AND a.status = 'active'
       GROUP BY a.app_id, a.name, a.tenant_id`,
      [tenantId, applicationId],
    );

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      appId: r.app_id,
      applicationName: r.app_name,
      tenantId: r.tenant_id,
      gapCount: Number(r.gap_count),
      attentionCount: Number(r.attention_count),
      drivers: r.drivers ?? [],
    };
  }
}

export const riskRepository = new RiskRepository();
