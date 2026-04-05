/**
 * tenantContext Middleware
 *
 * Validates that req.tenantId (set by requireAuth) corresponds to an active
 * tenant. Apply after requireAuth on any route that reads/writes tenant data.
 *
 * Usage:
 *   router.use(requireAuth, tenantContext);
 */

import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../modules/tenant/tenant.service';

export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantId) {
    res.status(401).json({
      success: false,
      error: 'Tenant context missing — authenticate first',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    tenantService.validateTenant(req.tenantId);
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    res.status(e.statusCode ?? 403).json({
      success: false,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
  }
}
