/**
 * Authentication Service
 *
 * Handles login (bcrypt-verified), token verification, and user lookup.
 * Delegates token issuance to the OIDC adapter.
 * Fires audit events for all authentication outcomes.
 *
 * Login flow:
 *   1. Look up user in PostgreSQL by username (global cross-tenant)
 *   2. Verify password with bcrypt.compare()
 *   3. Validate tenant status
 *   4. Issue JWT token via OIDC adapter
 *   5. Log audit events
 */

import bcrypt from 'bcryptjs';
import { User, TokenClaims } from '../security.types';
import { authRepository } from './auth.repository';
import { tenantRepository } from '../../tenant/tenant.repository';
import { oidcAdapter, TokenResponse } from './adapters/oidc.adapter';
import { auditService } from '../audit/audit.service';
import { getSeedMode } from '../../../config/seed-mode';

export interface LoginResult {
  token: TokenResponse;
  user: Omit<User, 'passwordHash'>;
}

class AuthService {

  /**
   * Authenticate a user with username + password.
   * Production: PostgreSQL only — fails closed (503) if PG is unavailable.
   * Demo/development: tries PG first, falls back to in-memory store.
   */
  async login(username: string, password: string, actorIp?: string): Promise<LoginResult> {
    const mode = getSeedMode();
    let user: User | undefined;
    let fromPg = false;

    if (mode === 'production') {
      // Production: PostgreSQL is the ONLY source of truth — no in-memory fallback
      try {
        user = await authRepository.findByUsernameGlobalPg(username);
        if (user) fromPg = true;
      } catch (err) {
        throw Object.assign(
          new Error('Authentication service unavailable — database connection failed'),
          { statusCode: 503 },
        );
      }
    } else {
      // Demo/development: try PG first, fall back to in-memory
      try {
        user = await authRepository.findByUsernameGlobalPg(username);
        if (user) fromPg = true;
      } catch {
        // PG not available in dev — acceptable
      }
      if (!user) {
        user = authRepository.findByUsernameGlobal(username);
      }
    }

    if (!user) {
      auditService.log({
        eventType: 'auth.login.failure',
        actorId:   username,
        actorName: username,
        actorIp,
        outcome:   'failure',
        reason:    'User not found',
        metadata:  { username },
      });
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    // Verify password — bcrypt only (no plaintext fallback)
    const hash = user.passwordHash ?? '';
    const isValid = hash.startsWith('$2')
      ? await bcrypt.compare(password, hash)
      : false;

    if (!isValid) {
      auditService.log({
        eventType: 'auth.login.failure',
        actorId:   user.userId,
        actorName: user.displayName,
        actorIp,
        outcome:   'failure',
        reason:    'Invalid password',
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

    // If user came from PostgreSQL, populate in-memory store so subsequent
    // synchronous lookups (findById, findAll, getUser, SCIM, etc.) can find them
    if (fromPg) {
      authRepository.save(user.tenantId, user);
    }

    const tenant = await tenantRepository.findById(user.tenantId);
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
