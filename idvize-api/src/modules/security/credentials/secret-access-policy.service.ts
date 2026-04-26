/**
 * Secret Access Policy Service
 *
 * Evaluates whether a user is permitted to perform a specific action
 * on a credential, enforcing field-level and action-level controls.
 *
 * Rules:
 *  - secrets.view.metadata — see credential name, type, status, expiry, vault path
 *  - secrets.reveal        — see raw secret value (Manager only, logged always)
 *  - secrets.rotate        — trigger rotation workflow
 *  - secrets.approve       — approve credential requests
 *  - secrets.reference     — register vault references (handoff completion)
 *  - secrets.manage.provider — configure vault providers
 *
 * Sensitivity-level escalation:
 *  - 'critical' credentials require an active approval in addition to the base permission
 *
 * AI safety rule:
 *  - This service must never include raw secret values in any return value,
 *    log message, audit event, or data structure outside of SecretValue wrapper
 */

import { CredentialRecord, CredentialSensitivity } from './credential.types';
import { authzService } from '../authz/authz.service';
import { auditService } from '../audit/audit.service';
import { approvalService } from '../approval/approval.service';
import { PermissionId } from '../security.types';

export type SecretAction =
  | 'view_metadata'
  | 'reveal'
  | 'rotate'
  | 'approve_request'
  | 'register_reference'
  | 'manage_provider'
  | 'retrieve_runtime';

const ACTION_TO_PERMISSION: Record<SecretAction, PermissionId> = {
  view_metadata:       'secrets.view.metadata',
  reveal:              'secrets.reveal',
  rotate:              'secrets.rotate',
  approve_request:     'secrets.approve',
  register_reference:  'secrets.reference',
  manage_provider:     'secrets.manage.provider',
  retrieve_runtime:    'secrets.reveal',    // runtime retrieval = reveal-level access
};

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresApproval?: boolean;
  pendingApprovalId?: string;
}

class SecretAccessPolicyService {

  /**
   * Evaluate whether a user can perform an action on a credential.
   * Logs the decision to the audit trail.
   */
  evaluate(
    tenantId: string,
    userId: string,
    action: SecretAction,
    credential: CredentialRecord,
    requestId?: string,
  ): PolicyDecision {
    const permissionId = ACTION_TO_PERMISSION[action];
    const decision = authzService.check(userId, permissionId);

    // Base permission denied
    if (!decision.allowed) {
      auditService.log({
        eventType: 'authz.deny',
        actorId: userId,
        actorName: userId,
        targetId: credential.credentialId,
        targetType: 'credential',
        permissionId,
        outcome: 'failure',
        reason: decision.reason,
        requestId,
        metadata: { action, credentialName: credential.name, sensitivityLevel: credential.sensitivityLevel },
      });
      return { allowed: false, reason: decision.reason };
    }

    // Sensitivity escalation: critical credentials require approved access request
    if (credential.sensitivityLevel === 'critical' && (action === 'reveal' || action === 'retrieve_runtime')) {
      const pendingApproval = approvalService.listAll(tenantId, { status: 'approved' })
        .find(r =>
          r.requesterId === userId &&
          r.resource === credential.credentialId &&
          r.status === 'approved'
        );

      if (!pendingApproval) {
        auditService.log({
          eventType: 'authz.deny',
          actorId: userId,
          actorName: userId,
          targetId: credential.credentialId,
          targetType: 'credential',
          permissionId,
          outcome: 'failure',
          reason: 'Critical credential requires an approved access request',
          requestId,
          metadata: { action, credentialName: credential.name, sensitivityLevel: 'critical' },
        });
        return {
          allowed: false,
          reason: 'Critical credential requires an approved access request. Submit a request via POST /security/approvals first.',
          requiresApproval: true,
        };
      }
    }

    // Reveal action: always audit regardless of outcome
    if (action === 'reveal' || action === 'retrieve_runtime') {
      auditService.log({
        eventType: 'authz.allow',
        actorId: userId,
        actorName: userId,
        targetId: credential.credentialId,
        targetType: 'credential',
        permissionId,
        resource: credential.credentialId,
        outcome: 'success',
        reason: `${action} granted: ${decision.reason}`,
        requestId,
        metadata: {
          action,
          credentialName: credential.name,
          // CRITICAL: raw secret value is NEVER logged here
          sensitivityLevel: credential.sensitivityLevel,
          vaultPath: credential.vaultPath ?? 'N/A',
        },
      });
    }

    return { allowed: true, reason: decision.reason };
  }

  /**
   * Strip restricted fields from a credential record based on caller's permissions.
   * Returns metadata-only view for users lacking secrets.view.metadata,
   * and omits vault path for users lacking secrets.reference.
   */
  applyFieldRestrictions(credential: CredentialRecord, userId: string): Partial<CredentialRecord> {
    const canViewMetadata = authzService.check(userId, 'secrets.view.metadata').allowed;
    const canViewReference = authzService.check(userId, 'secrets.reference').allowed;

    if (!canViewMetadata) {
      // Absolute minimum — just the ID and name
      return {
        credentialId: credential.credentialId,
        name: credential.name,
        status: credential.status,
        targetSystem: credential.targetSystem,
      };
    }

    const view: Partial<CredentialRecord> = {
      credentialId: credential.credentialId,
      name: credential.name,
      description: credential.description,
      credentialType: credential.credentialType,
      targetSystem: credential.targetSystem,
      targetEnvironment: credential.targetEnvironment,
      operatingMode: credential.operatingMode,
      status: credential.status,
      expiresAt: credential.expiresAt,
      rotationIntervalDays: credential.rotationIntervalDays,
      lastRotatedAt: credential.lastRotatedAt,
      lastAccessedAt: credential.lastAccessedAt,
      accessCount: credential.accessCount,
      rotationDue: credential.rotationDue,
      ownerName: credential.ownerName,
      sensitivityLevel: credential.sensitivityLevel,
      tags: credential.tags,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      vaultProvider: credential.vaultProvider,
    };

    // Vault path only visible to users who can register references or manage
    if (canViewReference) {
      view.vaultPath = credential.vaultPath;
      view.vaultSecretName = credential.vaultSecretName;
      view.vaultReferenceId = credential.vaultReferenceId;
      view.vaultVerifiedAt = credential.vaultVerifiedAt;
    } else {
      view.vaultPath = credential.vaultPath ? '[REFERENCE EXISTS]' : undefined;
    }

    return view;
  }
}

export const secretAccessPolicyService = new SecretAccessPolicyService();
