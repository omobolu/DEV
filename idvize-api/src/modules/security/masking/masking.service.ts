/**
 * Field-Level Masking Service
 *
 * Redacts restricted fields based on the caller's permissions.
 * Used by data services before returning sensitive records to controllers.
 *
 * Example: Architect calling GET /cost/people — annualCost is replaced
 * with "[RESTRICTED]" because they lack `cost.view.salary_detail`.
 */

import { PermissionId } from '../security.types';
import { authzService } from '../authz/authz.service';
import { auditService } from '../audit/audit.service';

export const REDACTED = '[RESTRICTED]' as const;

/**
 * Schema definitions: field paths that require specific permissions.
 * Any field listed here will be masked if the caller lacks the permission.
 */
export const FIELD_CLASSIFICATION_SCHEMAS: Record<string, {
  permission: PermissionId;
  fields: string[];
  description: string;
}[]> = {
  PersonCost: [
    {
      permission: 'cost.view.salary_detail',
      fields: ['annualCost', 'fteEquivalent'],
      description: 'Individual salary and compensation detail',
    },
  ],
  User: [
    {
      permission: 'security.manage.access',
      fields: ['passwordHash', 'attributes.clearanceLevel'],
      description: 'Sensitive user security attributes',
    },
  ],
  Contract: [
    {
      permission: 'cost.view.vendor_analysis',
      fields: ['annualCost', 'totalContractValue'],
      description: 'Contract financial detail',
    },
  ],
};

class MaskingService {
  /**
   * Mask a single object according to the schema and the caller's permissions.
   * Returns a deep clone with restricted fields replaced by REDACTED.
   */
  async maskObject<T extends Record<string, unknown>>(
    obj: T,
    userId: string,
    tenantId: string,
    schemaName: string,
    requestId?: string,
  ): Promise<T> {
    const schema = FIELD_CLASSIFICATION_SCHEMAS[schemaName];
    if (!schema) return obj;

    const clone = structuredClone(obj);
    let masked = false;

    for (const rule of schema) {
      const decision = authzService.check(userId, tenantId, rule.permission);
      if (!decision.allowed) {
        for (const field of rule.fields) {
          this.setNestedField(clone, field, REDACTED);
          masked = true;
        }
      }
    }

    if (masked) {
      await auditService.log({
        eventType: 'authz.field_masked',
        actorId: userId,
        actorName: userId,
        outcome: 'masked',
        reason: `Field-level masking applied for schema "${schemaName}"`,
        requestId,
        metadata: { schemaName },
      });
    }

    return clone;
  }

  /**
   * Mask an array of objects — applies maskObject to each element.
   */
  async maskArray<T extends Record<string, unknown>>(
    items: T[],
    userId: string,
    tenantId: string,
    schemaName: string,
    requestId?: string,
  ): Promise<T[]> {
    return Promise.all(items.map(item => this.maskObject(item, userId, tenantId, schemaName, requestId)));
  }

  /**
   * Check if a user can see a specific field.
   */
  canSeeField(userId: string, tenantId: string, schemaName: string, fieldPath: string): boolean {
    const schema = FIELD_CLASSIFICATION_SCHEMAS[schemaName];
    if (!schema) return true;
    for (const rule of schema) {
      if (rule.fields.includes(fieldPath)) {
        return authzService.check(userId, tenantId, rule.permission).allowed;
      }
    }
    return true;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] && typeof current[parts[i]] === 'object') {
        current = current[parts[i]] as Record<string, unknown>;
      } else {
        return; // path doesn't exist — nothing to mask
      }
    }
    const last = parts[parts.length - 1];
    if (last in current) {
      current[last] = value;
    }
  }
}

export const maskingService = new MaskingService();
