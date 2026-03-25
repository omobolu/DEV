import { Request, Response, NextFunction } from 'express';

// Paths that use Bearer token auth instead of API key.
// The entire /security module manages its own auth via requireAuth middleware.
const BEARER_AUTH_PREFIXES = [
  '/security',   // Module 7 — all routes use Bearer tokens (JWT) or are public (login)
  '/documents',  // Document Registry — Bearer JWT auth via requireAuth middleware
  '/os',         // IAM OS Kernel — all routes use Bearer JWT via requireAuth middleware
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
