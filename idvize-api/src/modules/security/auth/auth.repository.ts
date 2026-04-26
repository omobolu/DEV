/**
 * Auth / User Repository — PostgreSQL-backed, Multi-Tenant
 *
 * Stores users in PostgreSQL. Provides both tenant-scoped and global lookups.
 * Also maintains an in-memory cache populated on first access per tenant
 * so the existing in-memory seed path still works for non-persisted modules.
 */

import { User, UserRole } from '../security.types';
import pool from '../../../db/pool';

class AuthRepository {
  // In-memory fallback for modules that still seed via this repo directly
  private memStore = new Map<string, Map<string, User>>();
  private memByUsername = new Map<string, Map<string, string>>();

  private memBucket(tenantId: string): Map<string, User> {
    if (!this.memStore.has(tenantId)) this.memStore.set(tenantId, new Map());
    return this.memStore.get(tenantId)!;
  }
  private memNameBucket(tenantId: string): Map<string, string> {
    if (!this.memByUsername.has(tenantId)) this.memByUsername.set(tenantId, new Map());
    return this.memByUsername.get(tenantId)!;
  }

  private rowToUser(row: Record<string, unknown>): User {
    return {
      userId:       row.user_id as string,
      tenantId:     row.tenant_id as string,
      username:     row.username as string,
      displayName:  row.display_name as string,
      firstName:    row.first_name as string,
      lastName:     row.last_name as string,
      email:        row.email as string,
      department:   row.department as string | undefined,
      title:        row.title as string | undefined,
      roles:        (typeof row.roles === 'string' ? JSON.parse(row.roles as string) : row.roles) as UserRole[],
      groups:       (typeof row.groups === 'string' ? JSON.parse(row.groups as string) : row.groups) as string[],
      status:       row.status as User['status'],
      authProvider: row.auth_provider as User['authProvider'],
      mfaEnrolled:  row.mfa_enrolled as boolean,
      passwordHash: row.password_hash as string | undefined,
      attributes:   (typeof row.attributes === 'string' ? JSON.parse(row.attributes as string) : row.attributes) as Record<string, unknown>,
      lastLoginAt:  row.last_login_at ? (row.last_login_at as Date).toISOString() : undefined,
      createdAt:    (row.created_at as Date).toISOString(),
      updatedAt:    (row.updated_at as Date).toISOString(),
    };
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  save(tenantId: string, user: User): User {
    // Write to in-memory store (used by seed path at startup)
    this.memBucket(tenantId).set(user.userId, user);
    this.memNameBucket(tenantId).set(user.username.toLowerCase(), user.userId);
    return user;
  }

  updateLastLogin(tenantId: string, userId: string): void {
    const now = new Date().toISOString();
    // Update in-memory
    const user = this.memBucket(tenantId).get(userId);
    if (user) {
      user.lastLoginAt = now;
      user.updatedAt = now;
    }
    // Update PostgreSQL (fire-and-forget)
    pool.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    ).catch(() => { /* non-critical */ });
  }

  // ── Read (tenant-scoped) ───────────────────────────────────────────────────

  findById(tenantId: string, userId: string): User | undefined {
    return this.memBucket(tenantId).get(userId);
  }

  findByUsername(tenantId: string, username: string): User | undefined {
    const uid = this.memNameBucket(tenantId).get(username.toLowerCase());
    return uid ? this.memBucket(tenantId).get(uid) : undefined;
  }

  findAll(tenantId: string): User[] {
    return Array.from(this.memBucket(tenantId).values());
  }

  findByRole(tenantId: string, role: UserRole): User[] {
    return this.findAll(tenantId).filter(u => u.roles.includes(role));
  }

  count(tenantId: string): number {
    return this.memBucket(tenantId).size;
  }

  // ── Cross-tenant lookup (used by auth service for global login) ───────────

  findByUsernameGlobal(username: string): User | undefined {
    const lower = username.toLowerCase();
    for (const [, nameMap] of this.memByUsername) {
      const uid = nameMap.get(lower);
      if (uid) {
        for (const [, userMap] of this.memStore) {
          const u = userMap.get(uid);
          if (u) return u;
        }
      }
    }
    return undefined;
  }

  /**
   * PostgreSQL-backed global username lookup with bcrypt password hash.
   * Used by the auth service for login when PostgreSQL is available.
   */
  async findByUsernameGlobalPg(username: string): Promise<User | undefined> {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );
    if (result.rows.length === 0) return undefined;
    return this.rowToUser(result.rows[0]);
  }

  findByIdGlobal(userId: string): User | undefined {
    for (const [, userMap] of this.memStore) {
      const u = userMap.get(userId);
      if (u) return u;
    }
    return undefined;
  }
}

export const authRepository = new AuthRepository();
