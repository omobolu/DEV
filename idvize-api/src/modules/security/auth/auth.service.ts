/**
 * Authentication Service
 *
 * Handles login (password grant — mock), token verification, and user lookup.
 * Delegates token issuance to the OIDC adapter.
 * Fires audit events for all authentication outcomes.
 */

import { User, TokenClaims } from '../security.types';
import { authRepository } from './auth.repository';
import { tenantRepository } from '../../tenant/tenant.repository';
import { oidcAdapter, TokenResponse } from './adapters/oidc.adapter';
import { auditService } from '../audit/audit.service';

export interface LoginResult {
  token: TokenResponse;
  user: Omit<User, 'passwordHash'>;
}

class AuthService {

  /**
   * Authenticate a user with username + password (mock/local provider).
   * Phase 2: delegate to real OIDC authorization code flow.
   * Performs a cross-tenant global username lookup — acceptable for Phase 1.
   */
  async login(username: string, password: string, actorIp?: string): Promise<LoginResult> {
    const user = authRepository.findByUsernameGlobal(username);

    if (!user || user.passwordHash !== password) {
      auditService.log({
        eventType: 'auth.login.failure',
        actorId:   username,
        actorName: username,
        actorIp,
        outcome:   'failure',
        reason:    user ? 'Invalid password' : 'User not found',
        metadata:  { username },
      });
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    if (user.status !== 'active') {
      auditService.log({
        eventType: 'auth.login.failure',
        actorId:   user.userId,
        actorName: user.displayName,
        actorIp,
        outcome:   'failure',
        reason:    `Account is ${user.status}`,
        metadata:  { userId: user.userId },
      });
      throw Object.assign(new Error(`Account is ${user.status}`), { statusCode: 403 });
    }

    const tenant = tenantRepository.findById(user.tenantId);
    if (!tenant || tenant.status === 'suspended') {
      throw Object.assign(new Error('Tenant not available'), { statusCode: 403 });
    }

    const token = await oidcAdapter.issueToken(user, tenant);
    authRepository.updateLastLogin(user.tenantId, user.userId);

    auditService.log({
      tenantId:  user.tenantId,
      eventType: 'auth.login.success',
      actorId:   user.userId,
      actorName: user.displayName,
      actorIp,
      outcome:   'success',
      metadata:  { username, authProvider: user.authProvider, roles: user.roles },
    });

    auditService.log({
      tenantId:  user.tenantId,
      eventType: 'auth.token.issued',
      actorId:   user.userId,
      actorName: user.displayName,
      actorIp,
      outcome:   'success',
      metadata:  { expiresIn: token.expires_in },
    });

    const { passwordHash: _pw, ...safeUser } = user;
    return { token, user: { ...safeUser, tenantName: tenant.name } as Omit<User, 'passwordHash'> & { tenantName: string } };
  }

  /**
   * Verify a Bearer token and return decoded claims.
   */
  async verifyToken(token: string): Promise<TokenClaims | null> {
    return oidcAdapter.verifyToken(token);
  }

  /**
   * Get a user's profile (safe — no password hash).
   * Scoped to the user's own tenant.
   */
  getUser(tenantId: string, userId: string): Omit<User, 'passwordHash'> | undefined {
    const user = authRepository.findById(tenantId, userId);
    if (!user) return undefined;
    const { passwordHash: _pw, ...safeUser } = user;
    return safeUser;
  }

  listUsers(tenantId: string): Omit<User, 'passwordHash'>[] {
    return authRepository.findAll(tenantId).map(({ passwordHash: _pw, ...u }) => u);
  }

  recordLogout(userId: string, tenantId: string, sessionId: string, actorIp?: string): void {
    const user = authRepository.findByIdGlobal(userId);
    auditService.log({
      tenantId,
      eventType: 'auth.logout',
      actorId:   userId,
      actorName: user?.displayName ?? userId,
      actorIp,
      outcome:   'success',
      sessionId,
      metadata:  {},
    });
  }
}

export const authService = new AuthService();
