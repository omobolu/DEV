/**
 * SCIM Repository
 *
 * In-memory store for SCIM-provisioned Users and Groups.
 * Separate from the auth repository so SCIM resources map cleanly
 * to RFC 7643 schemas before being merged into the user store.
 * Phase 2: replace with PostgreSQL.
 */

import { Group } from '../security.types';

class ScimGroupRepository {
  private store    = new Map<string, Map<string, Group>>();
  private byScimId = new Map<string, Map<string, string>>(); // tenantId → scimId → groupId

  private groupBucket(tenantId: string): Map<string, Group> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  private scimBucket(tenantId: string): Map<string, string> {
    if (!this.byScimId.has(tenantId)) this.byScimId.set(tenantId, new Map());
    return this.byScimId.get(tenantId)!;
  }

  save(tenantId: string, group: Group): Group {
    this.groupBucket(tenantId).set(group.groupId, group);
    if (group.scimId) this.scimBucket(tenantId).set(group.scimId, group.groupId);
    return group;
  }

  findById(tenantId: string, groupId: string): Group | undefined {
    return this.groupBucket(tenantId).get(groupId);
  }

  findByScimId(tenantId: string, scimId: string): Group | undefined {
    const id = this.scimBucket(tenantId).get(scimId);
    return id ? this.groupBucket(tenantId).get(id) : undefined;
  }

  findAll(tenantId: string): Group[] {
    return Array.from(this.groupBucket(tenantId).values());
  }

  delete(tenantId: string, groupId: string): boolean {
    const group = this.groupBucket(tenantId).get(groupId);
    if (!group) return false;
    if (group.scimId) this.scimBucket(tenantId).delete(group.scimId);
    this.groupBucket(tenantId).delete(groupId);
    return true;
  }

  count(tenantId: string): number {
    return this.groupBucket(tenantId).size;
  }
}

export const scimGroupRepository = new ScimGroupRepository();
