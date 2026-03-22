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
  private store = new Map<string, Group>();
  private byScimId = new Map<string, string>(); // scimId → groupId

  save(group: Group): Group {
    this.store.set(group.groupId, group);
    if (group.scimId) this.byScimId.set(group.scimId, group.groupId);
    return group;
  }

  findById(groupId: string): Group | undefined {
    return this.store.get(groupId);
  }

  findByScimId(scimId: string): Group | undefined {
    const id = this.byScimId.get(scimId);
    return id ? this.store.get(id) : undefined;
  }

  findAll(): Group[] {
    return Array.from(this.store.values());
  }

  delete(groupId: string): boolean {
    const group = this.store.get(groupId);
    if (!group) return false;
    if (group.scimId) this.byScimId.delete(group.scimId);
    this.store.delete(groupId);
    return true;
  }

  count(): number {
    return this.store.size;
  }
}

export const scimGroupRepository = new ScimGroupRepository();
