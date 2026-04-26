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
 */

import { v4 as uuidv4 } from 'uuid';
import type { EvidenceRecord, EvidenceType } from './agent-execution.types';

class EvidenceStoreService {
  private evidence = new Map<string, Map<string, EvidenceRecord>>(); // tenantId → evidenceId → record

  /**
   * Record a new evidence artifact.
   */
  record(
    tenantId: string,
    sessionId: string,
    type: EvidenceType,
    title: string,
    description: string,
    data: Record<string, unknown>,
    stepId?: string,
  ): EvidenceRecord {
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

    if (!this.evidence.has(tenantId)) {
      this.evidence.set(tenantId, new Map());
    }
    this.evidence.get(tenantId)!.set(evidenceId, record);

    return record;
  }

  /**
   * Get a single evidence record.
   */
  getById(tenantId: string, evidenceId: string): EvidenceRecord | undefined {
    return this.evidence.get(tenantId)?.get(evidenceId);
  }

  /**
   * Get all evidence for a session.
   */
  getBySession(tenantId: string, sessionId: string): EvidenceRecord[] {
    const tenantEvidence = this.evidence.get(tenantId);
    if (!tenantEvidence) return [];
    return Array.from(tenantEvidence.values())
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Get evidence for a specific step.
   */
  getByStep(tenantId: string, stepId: string): EvidenceRecord[] {
    const tenantEvidence = this.evidence.get(tenantId);
    if (!tenantEvidence) return [];
    return Array.from(tenantEvidence.values())
      .filter(e => e.stepId === stepId);
  }

  // ── Sanitization ───────────────────────────────────────────────────────

  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      'password', 'secret', 'credential', 'token', 'apiKey', 'api_key',
      'client_secret', 'clientSecret', 'accessToken', 'access_token',
      'refreshToken', 'refresh_token', 'privateKey', 'private_key',
      'certificate', 'cert', 'key',
    ]);

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (sensitiveKeys.has(k) || sensitiveKeys.has(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        result[k] = this.sanitize(v as Record<string, unknown>);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
}

export const evidenceStoreService = new EvidenceStoreService();
