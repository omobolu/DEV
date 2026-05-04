/**
 * Email Action Token Service — Generates and validates one-time tokens
 * for approve/reject actions triggered directly from emails.
 *
 * Tokens are short-lived JWTs signed with the platform's JWT secret.
 * Each token includes a unique jti (JWT ID) claim and can only be used once.
 * Used token IDs are tracked in a bounded Map with automatic TTL cleanup.
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { secretsService } from '../security/secrets/secrets.service';

const TOKEN_TTL_HOURS = 24;
const TOKEN_TTL_MS = TOKEN_TTL_HOURS * 3600 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface EmailActionPayload {
  type: 'approval_action';
  jti: string;
  tenantId: string;
  sessionId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
}

// Map<jti, expiresAtMs> — bounded by TTL cleanup
const usedTokens = new Map<string, number>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of usedTokens) {
    if (now >= expiresAt) usedTokens.delete(jti);
  }
}, CLEANUP_INTERVAL_MS).unref();

class EmailActionTokenService {

  async generateToken(
    tenantId: string,
    sessionId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
  ): Promise<string> {
    const secret = await secretsService.get('JWT_SIGNING_SECRET');
    const jti = uuidv4();
    const payload: EmailActionPayload = {
      type: 'approval_action',
      jti,
      tenantId,
      sessionId,
      approvalId,
      decision,
    };

    return jwt.sign(payload, secret, {
      expiresIn: TOKEN_TTL_HOURS * 3600,
      issuer: 'idvize-email-action',
      audience: 'idvize-api',
    });
  }

  /**
   * Verify a token without consuming it — used to render the comment form.
   */
  async peekToken(token: string): Promise<EmailActionPayload> {
    const secret = await secretsService.get('JWT_SIGNING_SECRET');
    const decoded = jwt.verify(token, secret, {
      issuer: 'idvize-email-action',
      audience: 'idvize-api',
    }) as EmailActionPayload;

    if (decoded.type !== 'approval_action') {
      throw new Error('Invalid action token type');
    }

    if (usedTokens.has(decoded.jti)) {
      throw new Error('This action link has already been used');
    }

    return decoded;
  }

  /**
   * Validate and consume a token — single use.
   */
  async validateToken(token: string): Promise<EmailActionPayload> {
    const decoded = await this.peekToken(token);
    usedTokens.set(decoded.jti, Date.now() + TOKEN_TTL_MS);
    return decoded;
  }
}

export const emailActionTokenService = new EmailActionTokenService();
