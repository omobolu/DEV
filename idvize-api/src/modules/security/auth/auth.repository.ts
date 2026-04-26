/**
 * Auth / User Repository — Multi-Tenant
 *
 * In-memory store partitioned by tenantId.
 * Users are seeded by tenant.seed.ts at startup (not here).
 * Phase 2: replace with PostgreSQL (users table with tenant_id FK).
 */

import { User, UserRole } from '../security.types';

class AuthRepository {
  // tenantId → userId → User
  private store     = new Map<string, Map<string, User>>();
  // tenantId → username(lowercase) → userId
  private byUsername = new Map<string, Map<string, string>>();

  private userBucket(tenantId: string): Map<string, User> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  private nameBucket(tenantId: string): Map<string, string> {
    if (!this.byUsername.has(tenantId)) this.byUsername.set(tenantId, new Map());
    return this.byUsername.get(tenantId)!;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  save(tenantId: string, user: User): User {
    this.userBucket(tenantId).set(user.userId, user);
    this.nameBucket(tenantId).set(user.username.toLowerCase(), user.userId);
    return user;
  }

  updateLastLogin(tenantId: string, userId: string): void {
    const user = this.userBucket(tenantId).get(userId);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt   = new Date().toISOString();
    }
  }

  // ── Read (tenant-scoped) ───────────────────────────────────────────────────

  findById(tenantId: string, userId: string): User | undefined {
    return this.userBucket(tenantId).get(userId);
  }

  findByUsername(tenantId: string, username: string): User | undefined {
    const uid = this.nameBucket(tenantId).get(username.toLowerCase());
    return uid ? this.userBucket(tenantId).get(uid) : undefined;
  }

  findAll(tenantId: string): User[] {
    return Array.from(this.userBucket(tenantId).values());
  }

  findByRole(tenantId: string, role: UserRole): User[] {
    return this.findAll(tenantId).filter(u => u.roles.includes(role));
  }

  count(tenantId: string): number {
    return this.userBucket(tenantId).size;
  }

  // ── Cross-tenant lookup (used only by authz service + global login) ────────

  /**
   * Scan ALL tenant buckets for a username. Returns the first match.
   * Acceptable for Phase 1 (10 total users). Phase 2: require tenantId at login.
   */
  findByUsernameGlobal(username: string): User | undefined {
    const lower = username.toLowerCase();
    for (const [, nameMap] of this.byUsername) {
      const uid = nameMap.get(lower);
      if (uid) {
        // find which tenant bucket holds this uid
        for (const [, userMap] of this.store) {
          const u = userMap.get(uid);
          if (u) return u;
        }
      }
    }
    return undefined;
  }

  /**
   * Scan ALL tenant buckets for a userId. Returns the first match.
   * Used by authz service for role lookups.
   */
  findByIdGlobal(userId: string): User | undefined {
    for (const [, userMap] of this.store) {
      const u = userMap.get(userId);
      if (u) return u;
    }
    return undefined;
  }
}

export const authRepository = new AuthRepository();
