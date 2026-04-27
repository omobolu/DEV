/**
 * Evidence Store — Records execution artifacts for audit and compliance.
 *
 * Every tool action produces evidence:
 *   - API responses (sanitized — no credentials)
 *   - Configuration snapshots (before/after)
 *   - Test results
 *   - Approval records
 *   - Error logs
 *
 * Evidence is immutable, append-only, and tenant-scoped.
 * Backed by PostgreSQL — fails closed when PG is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import * as repo from './agent-execution.repository';
import type { EvidenceRecord, EvidenceType } from './agent-execution.types';

class EvidenceStoreService {

  /**
   * Record a new evidence artifact.
   */
  async record(
    tenantId: string,
    sessionId: string,
    type: EvidenceType,
    title: string,
    description: string,
    data: Record<string, unknown>,
    stepId?: string,
  ): Promise<EvidenceRecord> {
    const evidenceId = `ev-${uuidv4().split('-')[0]}`;

    // Sanitize data — remove any fields that might contain credentials
    const sanitizedData = this.sanitize(data);

    const record: EvidenceRecord = {
      evidenceId,
      sessionId,
      stepId,
      type,
      title,
      description,
      data: sanitizedData,
      createdAt: new Date().toISOString(),
    };

    await repo.saveEvidence(tenantId, record);

    return record;
  }

  /**
   * Get a single evidence record.
   */
  async getById(tenantId: string, evidenceId: string): Promise<EvidenceRecord | undefined> {
    return repo.getEvidenceById(tenantId, evidenceId);
  }

  /**
   * Get all evidence for a session.
   */
  async getBySession(tenantId: string, sessionId: string): Promise<EvidenceRecord[]> {
    return repo.getEvidenceBySession(tenantId, sessionId);
  }

  // ── Sanitization ───────────────────────────────────────────────────────

  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      'password', 'secret', 'credential', 'token', 'apiKey', 'api_key',
      'client_secret', 'clientSecret', 'accessToken', 'access_token',
      'refreshToken', 'refresh_token', 'privateKey', 'private_key',
      'certificate', 'cert', 'key', 'adminPassword', 'admin_password',
    ]);

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.has(k) || sensitiveKeys.has(lower) || this.containsSensitiveSubstring(lower)) {
        result[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        result[k] = this.sanitize(v as Record<string, unknown>);
      } else if (Array.isArray(v)) {
        result[k] = v.map(item =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? this.sanitize(item as Record<string, unknown>)
            : item,
        );
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  private containsSensitiveSubstring(key: string): boolean {
    const substrings = ['password', 'secret', 'credential', 'apikey', 'accesstoken', 'privatekey'];
    return substrings.some(s => key.includes(s));
  }
}

export const evidenceStoreService = new EvidenceStoreService();
