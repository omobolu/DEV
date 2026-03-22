/**
 * Credential Rotation Monitor Service
 *
 * Scans the credential registry for credentials that are expiring soon,
 * already expired, or overdue for rotation based on their rotation interval.
 * Flags them in the registry and generates a rotation report.
 *
 * Phase 2: trigger automated rotation workflows and send notifications.
 */

import { v4 as uuidv4 } from 'uuid';
import { CredentialRecord, RotationCheckResult, RotationMonitorReport } from './credential.types';
import { credentialRepository } from './credential.repository';
import { auditService } from '../audit/audit.service';

const EXPIRY_WARNING_DAYS = 30;

class CredentialRotationMonitorService {
  private lastReport: RotationMonitorReport | null = null;

  /**
   * Run a full rotation health check across all credentials.
   */
  runCheck(): RotationMonitorReport {
    const now = new Date();
    const allCredentials = credentialRepository.findAll()
      .filter(c => c.status !== 'revoked');

    const expiringSoon: RotationCheckResult[] = [];
    const expired: RotationCheckResult[] = [];
    const rotationRequired: RotationCheckResult[] = [];
    let healthyCount = 0;

    for (const cred of allCredentials) {
      const result = this.checkCredential(cred, now);

      if (result.rotationDue) {
        // Update the record to flag it
        cred.rotationDue = true;
        if (result.flaggedReason?.includes('expired') || (result.daysUntilExpiry !== undefined && result.daysUntilExpiry < 0)) {
          cred.status = 'expired';
          expired.push(result);
        } else if (cred.status === 'rotation_required' || result.flaggedReason?.includes('rotation interval')) {
          rotationRequired.push(result);
        } else {
          expiringSoon.push(result);
        }
        credentialRepository.save(cred);
      } else {
        healthyCount++;
      }
    }

    if (expiringSoon.length + expired.length + rotationRequired.length > 0) {
      auditService.log({
        eventType: 'user.updated',
        actorId: 'system',
        actorName: 'RotationMonitor',
        outcome: 'success',
        metadata: {
          action: 'rotation_check',
          expiringSoon: expiringSoon.length,
          expired: expired.length,
          rotationRequired: rotationRequired.length,
        },
      });
    }

    const report: RotationMonitorReport = {
      reportId: `rot-${uuidv4().split('-')[0]}`,
      checkedAt: now.toISOString(),
      totalCredentials: allCredentials.length,
      expiringSoon,
      expired,
      rotationRequired,
      healthy: healthyCount,
    };

    this.lastReport = report;

    console.log(`[RotationMonitor] Check complete: ${healthyCount} healthy, ${expiringSoon.length} expiring, ${expired.length} expired, ${rotationRequired.length} require rotation`);
    return report;
  }

  getLastReport(): RotationMonitorReport | null {
    return this.lastReport;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private checkCredential(cred: CredentialRecord, now: Date): RotationCheckResult {
    const result: RotationCheckResult = {
      credentialId: cred.credentialId,
      credentialName: cred.name,
      status: cred.status,
      expiresAt: cred.expiresAt,
      rotationDue: false,
    };

    // Check hard expiry
    if (cred.expiresAt) {
      const expiryDate = new Date(cred.expiresAt);
      const msUntilExpiry = expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
      result.daysUntilExpiry = daysUntilExpiry;

      if (daysUntilExpiry < 0) {
        result.rotationDue = true;
        result.flaggedReason = `Expired ${Math.abs(daysUntilExpiry)} day(s) ago`;
        return result;
      }

      if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
        result.rotationDue = true;
        result.flaggedReason = `Expires in ${daysUntilExpiry} day(s)`;
        return result;
      }
    }

    // Check rotation interval
    if (cred.rotationIntervalDays && cred.lastRotatedAt) {
      const lastRotated = new Date(cred.lastRotatedAt);
      const daysSinceRotation = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceRotation >= cred.rotationIntervalDays) {
        result.rotationDue = true;
        result.flaggedReason = `Rotation interval exceeded (${daysSinceRotation}d since last rotation, interval=${cred.rotationIntervalDays}d)`;
        return result;
      }
    }

    // Already marked as needing rotation
    if (cred.status === 'rotation_required') {
      result.rotationDue = true;
      result.flaggedReason = 'Manually flagged for rotation';
    }

    return result;
  }
}

export const credentialRotationMonitorService = new CredentialRotationMonitorService();
