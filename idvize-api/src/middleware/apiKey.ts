import { Request, Response, NextFunction } from 'express';

// All application routes use Bearer JWT auth (multi-tenant).
// API key auth is bypassed for every module route.
const BEARER_AUTH_PREFIXES = [
  '/security',
  '/documents',
  '/os',
  '/applications',
  '/controls',
  '/build',
  '/integrations',
  '/cost',
  '/maturity',
  '/value',
  '/tenants',
  '/gaps',
  '/connectors',
  '/orchestrate',
];

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check and Bearer-auth paths
  if (req.path === '/health') { next(); return; }
  if (BEARER_AUTH_PREFIXES.some(prefix => req.path.startsWith(prefix))) { next(); return; }


  const key = req.headers['x-api-key'] || req.query['api_key'];
  const expected = process.env.API_KEY;

  if (!expected || key === expected) {
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Unauthorized', timestamp: new Date().toISOString() });
}
