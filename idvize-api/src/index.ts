import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { apiKeyAuth } from './middleware/apiKey';
import { errorHandler } from './middleware/errorHandler';
import { controlService } from './modules/control/control.service';
import { seedTenants } from './modules/tenant/tenant.seed';

// ── Module Controllers ──────────────────────────────────────────────────────
import applicationController from './modules/application/application.controller';
import controlController from './modules/control/control.controller';
import buildController from './modules/build/build.controller';
import integrationController from './modules/integration/integration.controller';
import costController from './modules/cost/cost.controller';
import securityController from './modules/security/security.controller';
import documentController from './modules/document/document.controller';
import maturityController from './modules/maturity/maturity.controller';
import osController       from './modules/os/os.controller';
import valueController    from './modules/value/value.controller';
import tenantController   from './modules/tenant/tenant.controller';

// ── Legacy Phase-1 Routes (kept for backward compatibility) ─────────────────
import gapsRouter from './routes/gaps';
import connectorsRouter from './routes/connectors';
import orchestrateRouter from './routes/orchestrate';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));  // Allow large CSV imports
app.use(morgan('dev'));

// Request correlation ID for audit trail
app.use((req, res, next) => {
  const { v4: uuidv4 } = require('uuid');
  req.requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(apiKeyAuth);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'idvize-api',
    version: '2.0.0',
    platform: 'IDVIZE IAM OS',
    kernel:   'iam-coverage-intelligence-engine',
    environment: process.env.NODE_ENV ?? 'development',
    modules: {
      'Application Governance': 'active',
      'IAM Correlation': 'active',
      'Control Detection': 'active',
      'Build Execution': 'active',
      'Integration Adapters': 'active',
      'Cost & Vendor Intelligence': 'active',
      'Security & Identity Governance': 'active',
      'Document Registry': 'active',
      'Program Maturity':  'active',
    },
    integrations: {
      entraId: process.env.ENTRA_TENANT_ID ? 'configured' : 'mock',
      sailPoint: process.env.SAILPOINT_BASE_URL ? 'configured' : 'mock',
      cyberArk: process.env.CYBERARK_BASE_URL ? 'configured' : 'mock',
      okta: process.env.OKTA_DOMAIN ? 'configured' : 'mock',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Module Routes ────────────────────────────────────────────────────────────
app.use('/applications', applicationController);
app.use('/controls', controlController);
app.use('/build', buildController);
app.use('/integrations', integrationController);
app.use('/cost', costController);
app.use('/security', securityController);
app.use('/documents', documentController);
app.use('/maturity',  maturityController);
app.use('/os',        osController);
app.use('/value',     valueController);
app.use('/tenants',   tenantController);

// ─── Legacy API Routes (Phase 1 — kept for compatibility) ────────────────────
app.use('/api/gaps', gapsRouter);
app.use('/api/connectors', connectorsRouter);
app.use('/api/orchestrate', orchestrateRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`  IDVIZE IAM Operating System`);
  console.log(`  Kernel: iam-coverage-intelligence-engine  v2.0.0`);
  console.log(`========================================================`);
  console.log(`  URL         : http://localhost:${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`  Entra ID    : ${process.env.ENTRA_TENANT_ID ? '[live]' : '[mock]'}`);
  console.log(`  SailPoint   : ${process.env.SAILPOINT_BASE_URL ? '[live]' : '[mock]'}`);
  console.log(`  CyberArk    : ${process.env.CYBERARK_BASE_URL ? '[live]' : '[mock]'}`);
  console.log(`  Okta        : ${process.env.OKTA_DOMAIN ? '[live]' : '[mock]'}`);
  console.log(`\n  Module 1 — Application Governance`);
  console.log(`    POST /applications/import`);
  console.log(`    POST /applications`);
  console.log(`    GET  /applications`);
  console.log(`    GET  /applications/:id`);
  console.log(`    POST /controls/evaluate`);
  console.log(`    GET  /controls/:appId`);
  console.log(`\n  Module 4 — Build Execution`);
  console.log(`    POST /build/start`);
  console.log(`    GET  /build`);
  console.log(`    GET  /build/:id`);
  console.log(`    POST /build/:id/advance`);
  console.log(`    POST /build/:id/transition`);
  console.log(`    POST /build/:id/data`);
  console.log(`    POST /build/:id/artifacts`);
  console.log(`\n  Integration`);
  console.log(`    GET  /integrations/status`);
  console.log(`    POST /integrations/correlate/:appName`);
  console.log(`\n  Module 5 — Cost & Vendor Intelligence`);
  console.log(`    POST /cost/analyze`);
  console.log(`    GET  /cost/report`);
  console.log(`    GET  /cost/summary`);
  console.log(`    GET  /cost/vendor-analysis`);
  console.log(`    GET  /cost/optimization`);
  console.log(`    POST /cost/vendors  GET  /cost/vendors`);
  console.log(`    POST /cost/contracts  GET  /cost/contracts`);
  console.log(`    POST /cost/people  GET  /cost/people`);
  console.log(`\n  Module 7 — Security & Identity Governance`);
  console.log(`    POST /security/auth/token`);
  console.log(`    GET  /security/auth/me`);
  console.log(`    GET  /security/auth/matrix`);
  console.log(`    GET  /security/authz/check?permission=<id>`);
  console.log(`    GET  /security/authz/my-permissions`);
  console.log(`    GET  /security/masking/demo`);
  console.log(`    POST /security/approvals`);
  console.log(`    GET  /security/audit`);
  console.log(`    GET  /security/scim/v2/Users`);
  console.log(`    GET  /security/scim/v2/Groups`);
  console.log(`    GET  /security/status`);
  console.log(`\n  Module 7 — Secrets, Vault & Credential Governance`);
  console.log(`    POST /security/credentials/request`);
  console.log(`    GET  /security/credentials/requests`);
  console.log(`    POST /security/credentials/requests/:id/resolve`);
  console.log(`    POST /security/credentials`);
  console.log(`    GET  /security/credentials`);
  console.log(`    GET  /security/credentials/:id`);
  console.log(`    POST /security/credentials/:id/register-reference`);
  console.log(`    POST /security/credentials/:id/rotate`);
  console.log(`    POST /security/credentials/:id/revoke`);
  console.log(`    GET  /security/credentials/rotation/report`);
  console.log(`    GET  /security/vault/providers`);
  console.log(`    GET  /security/vault/status`);
  console.log(`    GET  /security/vault/events`);
  console.log(`\n  Document Registry`);
  console.log(`    GET  /documents`);
  console.log(`    POST /documents`);
  console.log(`    GET  /documents/:id`);
  console.log(`    PATCH /documents/:id`);
  console.log(`    POST /documents/:id/submit`);
  console.log(`    POST /documents/:id/review`);
  console.log(`    POST /documents/:id/publish`);
  console.log(`    POST /documents/:id/archive`);
  console.log(`\n  AI Analysis`);
  console.log(`    POST /cost/analyze/ai`);
  console.log(`    GET  /security/posture`);
  console.log(`    POST /security/posture/ai`);
  console.log(`\n  IAM OS Kernel`);
  console.log(`    GET  /os/status`);
  console.log(`    GET  /os/coverage`);
  console.log(`    GET  /os/gaps`);
  console.log(`    POST /os/gaps/:gapId/action`);
  console.log(`    GET  /os/identity-plane`);
  console.log(`    GET  /os/drivers`);
  console.log(`    GET  /os/processes`);
  console.log(`    GET  /os/modules`);
  console.log(`    GET  /os/events`);
  console.log(`    GET  /os/alerts`);
  console.log(`========================================================\n`);

  // Seed demo tenants, users, and application portfolios
  seedTenants();
});

export default app;
