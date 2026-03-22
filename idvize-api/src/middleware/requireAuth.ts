/**
 * requireAuth Middleware
 *
 * Validates the Authorization: Bearer <token> header.
 * Decodes and verifies the JWT, attaches TokenClaims to req.user.
 * Returns 401 if token is missing, invalid, or expired.
 *
 * Usage: apply to individual routes or router-level.
 *   router.use(requireAuth);
 *   router.get('/protected', requireAuth, handler);
 */

import { Request, Response, NextFunction } from 'express';
import { TokenClaims } from '../modules/security/security.types';
import { authService } from '../modules/security/auth/auth.service';

// Extend Express Request to carry the decoded token claims
declare global {
  namespace Express {
    interface Request {
      user?: TokenClaims;
      requestId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required — provide Authorization: Bearer <token>',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.slice(7);
  const claims = await authService.verifyToken(token);

  if (!claims) {
    res.status(401).json({
      success: false,
      error: 'Token invalid or expired',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = claims;
  next();
}
