/**
 * Rollback Tracker — Tracks external objects created by execution sessions
 * for safe rollback on failure.
 *
 * Security invariants:
 *   - Rollback only touches objects created by the SAME session
 *   - Never rollback by name alone — always by stored external object ID
 *   - Ownership validated: tenantId + sessionId must match
 *   - All rollback actions are audit-logged
 */

import { auditService } from '../security/audit/audit.service';
import type { SystemType } from './agent-execution.types';

export type RollbackStatus = 'pending' | 'rollback_required' | 'rolled_back';

export interface CreatedObject {
  id: string;                      // Internal tracking ID
  tenantId: string;
  sessionId: string;
  stepId: string;
  systemType: SystemType;
  externalObjectId: string;        // ID returned by the external API
  objectType: string;              // e.g. 'enterprise_app', 'group', 'source'
  displayName?: string;            // Human-readable label
  rollbackAction?: string;         // e.g. 'DELETE /v1.0/applications/{id}'
  rolledBack: boolean;
  rollbackStatus: RollbackStatus;
  rolledBackAt?: string;
  createdAt: string;
}

// In-memory store partitioned by tenantId → sessionId → CreatedObject[]
const store = new Map<string, Map<string, CreatedObject[]>>();

class RollbackTrackerService {

  /**
   * Register an externally-created object for potential rollback.
   */
  track(
    tenantId: string,
    sessionId: string,
    stepId: string,
    systemType: SystemType,
    externalObjectId: string,
    objectType: string,
    displayName?: string,
    rollbackAction?: string,
  ): CreatedObject {
    const obj: CreatedObject = {
      id: `ro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      sessionId,
      stepId,
      systemType,
      externalObjectId,
      objectType,
      displayName,
      rollbackAction,
      rolledBack: false,
      rollbackStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (!store.has(tenantId)) store.set(tenantId, new Map());
    const tenantStore = store.get(tenantId)!;
    if (!tenantStore.has(sessionId)) tenantStore.set(sessionId, []);
    tenantStore.get(sessionId)!.push(obj);

    return obj;
  }

  /**
   * Get all objects created by a specific session (tenant-scoped).
   */
  getSessionObjects(tenantId: string, sessionId: string): CreatedObject[] {
    return store.get(tenantId)?.get(sessionId) ?? [];
  }

  /**
   * Get objects created by a specific step within a session.
   */
  getStepObjects(tenantId: string, sessionId: string, stepId: string): CreatedObject[] {
    return this.getSessionObjects(tenantId, sessionId).filter(o => o.stepId === stepId);
  }

  /**
   * Look up a created object by its external ID within a session.
   * Used to chain outputs: step N creates an app → step N+1 uses the ID.
   */
  findByExternalId(tenantId: string, sessionId: string, externalObjectId: string): CreatedObject | undefined {
    return this.getSessionObjects(tenantId, sessionId).find(o => o.externalObjectId === externalObjectId);
  }

  /**
   * Mark an object as requiring manual rollback. The actual deletion
   * of external objects is NOT performed automatically — an operator
   * must execute the rollback action described in rollbackAction.
   */
  async markRollbackRequired(
    tenantId: string,
    sessionId: string,
    externalObjectId: string,
    actorId: string,
    actorName: string,
  ): Promise<void> {
    const objects = this.getSessionObjects(tenantId, sessionId);
    const obj = objects.find(o => o.externalObjectId === externalObjectId);
    if (!obj) return;

    obj.rollbackStatus = 'rollback_required';

    await auditService.log({
      tenantId,
      eventType: 'agent.rollback.required',
      actorId,
      actorName,
      targetType: 'external_object',
      targetId: externalObjectId,
      resource: 'agent_execution',
      outcome: 'failure',
      metadata: {
        sessionId,
        stepId: obj.stepId,
        systemType: obj.systemType,
        objectType: obj.objectType,
        rollbackAction: obj.rollbackAction,
      },
    });
  }

  /**
   * Get all objects pending rollback for a session.
   */
  getPendingRollbacks(tenantId: string, sessionId: string): CreatedObject[] {
    return this.getSessionObjects(tenantId, sessionId).filter(o => o.rollbackStatus === 'pending');
  }

  /**
   * Clean up tracking data for a completed session.
   */
  cleanupSession(tenantId: string, sessionId: string): void {
    store.get(tenantId)?.delete(sessionId);
  }
}

export const rollbackTracker = new RollbackTrackerService();
