/**
 * Email Action Token Service — Generates and validates one-time tokens
 * for approve/reject actions triggered directly from emails.
 *
 * Tokens are short-lived JWTs signed with the platform's JWT secret.
 * Each token encodes the action context (sessionId, approvalId, tenantId, decision)
 * and can only be used once.
 */

import jwt from 'jsonwebtoken';
import { secretsService } from '../security/secrets/secrets.service';

const TOKEN_TTL_HOURS = 24;

interface EmailActionPayload {
  type: 'approval_action';
  tenantId: string;
  sessionId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
}

const usedTokens = new Set<string>();

class EmailActionTokenService {

  async generateToken(
    tenantId: string,
    sessionId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
  ): Promise<string> {
    const secret = await secretsService.get('JWT_SIGNING_SECRET');
    const payload: EmailActionPayload = {
      type: 'approval_action',
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
    if (usedTokens.has(token)) {
      throw new Error('This action link has already been used');
    }

    const secret = await secretsService.get('JWT_SIGNING_SECRET');
    const decoded = jwt.verify(token, secret, {
      issuer: 'idvize-email-action',
      audience: 'idvize-api',
    }) as EmailActionPayload;

    if (decoded.type !== 'approval_action') {
      throw new Error('Invalid action token type');
    }

    return decoded;
  }

  /**
   * Validate and consume a token — single use.
   */
  async validateToken(token: string): Promise<EmailActionPayload> {
    const decoded = await this.peekToken(token);
    usedTokens.add(token);
    return decoded;
  }
}

export const emailActionTokenService = new EmailActionTokenService();
