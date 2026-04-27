/**
 * requirePermission Middleware Factory
 *
 * Returns an Express middleware that checks whether the authenticated user
 * has the specified permission. Emits an authz audit event for every check.
 *
 * MUST be used after requireAuth (needs req.user).
 *
 * Usage:
 *   router.get('/cost/people', requireAuth, requirePermission('cost.view.salary_detail'), handler);
 *   router.get('/cost/summary', requireAuth, requirePermission('cost.view.summary'), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { PermissionId, EvaluationContext } from '../modules/security/security.types';
import { authzService } from '../modules/security/authz/authz.service';
import { auditService } from '../modules/security/audit/audit.service';

export function requirePermission(
  permissionId: PermissionId,
  contextFn?: (req: Request) => EvaluationContext,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
      return;
    }

    const userId = req.user.sub;
    const context = contextFn ? contextFn(req) : {};
    const decision = authzService.check(userId, permissionId, context);

    auditService.log({
      eventType: decision.allowed ? 'authz.allow' : 'authz.deny',
      actorId: userId,
      actorName: req.user.name,
      permissionId,
      resource: req.path,
      outcome: decision.allowed ? 'success' : 'failure',
      reason: decision.reason,
      requestId: req.requestId,
      metadata: { method: req.method, path: req.path, matchedPolicy: decision.matchedPolicy },
      tenantId: req.user?.tenantId,
    });

    if (!decision.allowed) {
      res.status(403).json({
        success: false,
        error: `Access denied: ${decision.reason}`,
        permissionRequired: permissionId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
