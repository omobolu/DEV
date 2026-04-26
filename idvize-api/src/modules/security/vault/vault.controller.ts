/**
 * Vault Controller
 *
 * GET  /vault/providers   — list configured vault providers and their status
 * GET  /vault/status      — overall vault health summary
 * GET  /vault/events      — vault access event log
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { tenantContext } from '../../../middleware/tenantContext';
import { vaultAdapterService } from './vault.adapter.service';
import { vaultAccessEventRepository, VaultEventFilter } from './vault-access-event.repository';
import { VaultAccessEvent, VaultAccessEventType } from './vault.types';

const router = Router();
router.use(requireAuth, tenantContext);

// GET /vault/providers
router.get('/providers', requirePermission('secrets.view.metadata'), async (_req: Request, res: Response) => {
  const configs = await vaultAdapterService.getProviderConfigs();
  res.json({
    success: true,
    data: {
      total: configs.length,
      defaultProvider: vaultAdapterService.getDefaultProvider(),
      providers: configs,
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /vault/status
router.get('/status', requirePermission('secrets.view.metadata'), async (_req: Request, res: Response) => {
  const configs = await vaultAdapterService.getProviderConfigs();
  const healthy = configs.filter(c => c.status === 'healthy' || c.status === 'mock').length;
  const degraded = configs.filter(c => c.status === 'degraded').length;
  const unavailable = configs.filter(c => c.status === 'unreachable' || c.status === 'unconfigured').length;

  const overallStatus =
    unavailable === configs.length ? 'critical' :
    degraded > 0 ? 'degraded' : 'healthy';

  res.json({
    success: true,
    data: {
      summary: {
        total: configs.length,
        healthy,
        degraded,
        unavailable,
        overallStatus,
      },
      defaultProvider: vaultAdapterService.getDefaultProvider(),
      providers: configs.map(c => ({
        providerType: c.providerType,
        displayName: c.displayName,
        status: c.status,
        configuredVia: c.configuredVia,
        capabilities: c.capabilities,
        healthCheckedAt: c.healthCheckedAt,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /vault/events
router.get('/events', requirePermission('secrets.view.metadata'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { credentialId, actorId, eventType, outcome, limit, offset } = req.query;

  const filter: VaultEventFilter = {
    credentialId: credentialId as string | undefined,
    actorId: actorId as string | undefined,
    eventType: eventType as VaultAccessEventType | undefined,
    outcome: outcome as VaultAccessEvent['outcome'] | undefined,
    limit: limit ? Math.min(Number(limit), 500) : 100,
    offset: offset ? Number(offset) : 0,
  };

  const events = vaultAccessEventRepository.query(tenantId, filter);

  res.json({
    success: true,
    data: {
      total: events.length,
      events,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
