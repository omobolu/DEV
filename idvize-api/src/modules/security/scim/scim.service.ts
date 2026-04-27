/**
 * SCIM 2.0 Inbound Provisioning Service
 *
 * Implements RFC 7643 (SCIM Core Schema) and RFC 7644 (SCIM Protocol).
 * Handles User and Group CRUD triggered by Okta, Entra, or any SCIM 2.0 IdP.
 *
 * On user create/update: syncs to the auth repository so provisioned users
 * can authenticate immediately.
 * On user delete: sets status to 'deprovisioned' (soft delete — never hard delete).
 */

import { v4 as uuidv4 } from 'uuid';
import { User, Group, GroupMember, UserRole } from '../security.types';
import { scimGroupRepository } from './scim.repository';
import { authRepository } from '../auth/auth.repository';
import { auditService } from '../audit/audit.service';

// ── SCIM Resource Schemas ─────────────────────────────────────────────────────

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

// ── SCIM Payload Types ────────────────────────────────────────────────────────

export interface ScimUserPayload {
  schemas?: string[];
  externalId?: string;
  userName: string;
  name?: { givenName?: string; familyName?: string; formatted?: string };
  displayName?: string;
  emails?: Array<{ value: string; primary?: boolean; type?: string }>;
  active?: boolean;
  title?: string;
  department?: string;
  groups?: Array<{ value: string; display?: string }>;
  [key: string]: unknown;
}

export interface ScimGroupPayload {
  schemas?: string[];
  externalId?: string;
  displayName: string;
  members?: Array<{ value: string; display?: string }>;
  [key: string]: unknown;
}

export interface ScimPatchOp {
  schemas: string[];
  Operations: Array<{
    op: 'add' | 'remove' | 'replace';
    path?: string;
    value?: unknown;
  }>;
}

class ScimService {

  // ── SCIM Response Formatters ─────────────────────────────────────────────

  toScimUser(user: User): Record<string, unknown> {
    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.scimId ?? user.userId,
      externalId: user.externalId,
      userName: user.username,
      name: { givenName: user.firstName, familyName: user.lastName, formatted: user.displayName },
      displayName: user.displayName,
      title: user.title,
      department: user.department,
      emails: [{ value: user.email, primary: true, type: 'work' }],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.createdAt,
        lastModified: user.updatedAt,
        location: `/security/scim/v2/Users/${user.scimId ?? user.userId}`,
      },
    };
  }

  toScimGroup(group: Group): Record<string, unknown> {
    return {
      schemas: [SCIM_GROUP_SCHEMA],
      id: group.scimId ?? group.groupId,
      externalId: group.externalId,
      displayName: group.displayName,
      members: group.members.map(m => ({ value: m.userId, display: m.displayName })),
      meta: {
        resourceType: 'Group',
        created: group.createdAt,
        lastModified: group.updatedAt,
        location: `/security/scim/v2/Groups/${group.scimId ?? group.groupId}`,
      },
    };
  }

  scimList<T>(resources: T[], totalResults: number, startIndex = 1): Record<string, unknown> {
    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  // ── User Operations ──────────────────────────────────────────────────────

  listUsers(tenantId: string, filter?: string): Record<string, unknown> {
    let users = authRepository.findAll(tenantId);
    if (filter) {
      // Support basic: userName eq "foo@bar.com"
      const eqMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (eqMatch) users = users.filter(u => u.username.toLowerCase() === eqMatch[1].toLowerCase());
    }
    const formatted = users.map(u => this.toScimUser(u));
    return this.scimList(formatted, formatted.length);
  }

  getUser(tenantId: string, scimId: string): Record<string, unknown> | undefined {
    const user = authRepository.findById(tenantId, scimId)
      ?? authRepository.findAll(tenantId).find(u => u.scimId === scimId);
    return user ? this.toScimUser(user) : undefined;
  }

  async createUser(tenantId: string, payload: ScimUserPayload, actorId = 'scim-provisioner'): Promise<Record<string, unknown>> {
    const existing = authRepository.findByUsername(tenantId, payload.userName);
    if (existing) {
      // SCIM spec: return existing resource if userName matches
      return this.toScimUser(existing);
    }

    const now = new Date().toISOString();
    const scimId = uuidv4();
    const primaryEmail = payload.emails?.find(e => e.primary)?.value ?? payload.emails?.[0]?.value ?? payload.userName;

    const user: User = {
      tenantId,
      userId: `usr-${uuidv4().split('-')[0]}`,
      scimId,
      externalId: payload.externalId,
      username: payload.userName,
      displayName: payload.displayName ?? ((`${payload.name?.givenName ?? ''} ${payload.name?.familyName ?? ''}`.trim()) || payload.userName),
      firstName: payload.name?.givenName ?? '',
      lastName: payload.name?.familyName ?? '',
      email: primaryEmail,
      department: payload.department,
      title: payload.title,
      roles: this.inferRolesFromGroups(payload.groups?.map(g => g.display ?? g.value) ?? []),
      groups: payload.groups?.map(g => g.value) ?? [],
      status: payload.active !== false ? 'active' : 'pending',
      authProvider: 'oidc',
      mfaEnrolled: false,
      attributes: {},
      createdAt: now,
      updatedAt: now,
    };

    authRepository.save(tenantId, user);

    await auditService.log({
      tenantId,
      eventType: 'scim.user.create',
      actorId,
      actorName: actorId,
      targetId: user.userId,
      targetType: 'user',
      outcome: 'success',
      metadata: { scimId, userName: user.username, roles: user.roles },
    });

    return this.toScimUser(user);
  }

  async updateUser(tenantId: string, scimId: string, payload: ScimUserPayload, actorId = 'scim-provisioner'): Promise<Record<string, unknown> | undefined> {
    const user = authRepository.findById(tenantId, scimId)
      ?? authRepository.findAll(tenantId).find(u => u.scimId === scimId);
    if (!user) return undefined;

    const primaryEmail = payload.emails?.find(e => e.primary)?.value ?? payload.emails?.[0]?.value ?? user.email;

    user.username = payload.userName ?? user.username;
    user.displayName = payload.displayName ?? user.displayName;
    user.firstName = payload.name?.givenName ?? user.firstName;
    user.lastName = payload.name?.familyName ?? user.lastName;
    user.email = primaryEmail;
    user.department = payload.department ?? user.department;
    user.title = payload.title ?? user.title;
    user.status = payload.active !== undefined ? (payload.active ? 'active' : 'suspended') : user.status;
    user.updatedAt = new Date().toISOString();

    authRepository.save(tenantId, user);

    await auditService.log({
      tenantId,
      eventType: 'scim.user.update',
      actorId,
      actorName: actorId,
      targetId: user.userId,
      targetType: 'user',
      outcome: 'success',
      metadata: { scimId, userName: user.username },
    });

    return this.toScimUser(user);
  }

  async patchUser(tenantId: string, scimId: string, patch: ScimPatchOp, actorId = 'scim-provisioner'): Promise<Record<string, unknown> | undefined> {
    const user = authRepository.findById(tenantId, scimId)
      ?? authRepository.findAll(tenantId).find(u => u.scimId === scimId);
    if (!user) return undefined;

    for (const op of patch.Operations) {
      if (op.path === 'active' || (op.path === undefined && typeof op.value === 'object' && op.value !== null)) {
        const val = op.path === 'active' ? op.value : (op.value as Record<string, unknown>)['active'];
        if (val !== undefined) {
          user.status = val ? 'active' : 'suspended';
        }
      }
    }
    user.updatedAt = new Date().toISOString();
    authRepository.save(tenantId, user);

    await auditService.log({
      tenantId,
      eventType: 'scim.user.update',
      actorId,
      actorName: actorId,
      targetId: user.userId,
      targetType: 'user',
      outcome: 'success',
      metadata: { scimId, operations: patch.Operations.length },
    });

    return this.toScimUser(user);
  }

  async deprovisionUser(tenantId: string, scimId: string, actorId = 'scim-provisioner'): Promise<boolean> {
    const user = authRepository.findById(tenantId, scimId)
      ?? authRepository.findAll(tenantId).find(u => u.scimId === scimId);
    if (!user) return false;

    user.status = 'deprovisioned';
    user.updatedAt = new Date().toISOString();
    authRepository.save(tenantId, user);

    await auditService.log({
      tenantId,
      eventType: 'scim.user.delete',
      actorId,
      actorName: actorId,
      targetId: user.userId,
      targetType: 'user',
      outcome: 'success',
      metadata: { scimId, userId: user.userId },
    });

    return true;
  }

  // ── Group Operations ─────────────────────────────────────────────────────

  listGroups(tenantId: string): Record<string, unknown> {
    const groups = scimGroupRepository.findAll(tenantId).map(g => this.toScimGroup(g));
    return this.scimList(groups, groups.length);
  }

  getGroup(tenantId: string, scimId: string): Record<string, unknown> | undefined {
    const group = scimGroupRepository.findByScimId(tenantId, scimId) ?? scimGroupRepository.findById(tenantId, scimId);
    return group ? this.toScimGroup(group) : undefined;
  }

  async createGroup(tenantId: string, payload: ScimGroupPayload, actorId = 'scim-provisioner'): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const scimId = uuidv4();

    const members: GroupMember[] = (payload.members ?? []).map(m => {
      const user = authRepository.findById(tenantId, m.value);
      return { userId: m.value, displayName: m.display ?? user?.displayName ?? m.value };
    });

    const group: Group = {
      groupId: `grp-${uuidv4().split('-')[0]}`,
      scimId,
      externalId: payload.externalId,
      displayName: payload.displayName,
      members,
      mappedRoles: this.inferRolesFromGroups([payload.displayName]),
      source: 'scim',
      createdAt: now,
      updatedAt: now,
    };

    scimGroupRepository.save(tenantId, group);

    await auditService.log({
      tenantId,
      eventType: 'scim.group.create',
      actorId,
      actorName: actorId,
      targetId: group.groupId,
      targetType: 'group',
      outcome: 'success',
      metadata: { scimId, displayName: group.displayName, memberCount: members.length },
    });

    return this.toScimGroup(group);
  }

  async updateGroup(tenantId: string, scimId: string, payload: ScimGroupPayload, actorId = 'scim-provisioner'): Promise<Record<string, unknown> | undefined> {
    const group = scimGroupRepository.findByScimId(tenantId, scimId) ?? scimGroupRepository.findById(tenantId, scimId);
    if (!group) return undefined;

    group.displayName = payload.displayName ?? group.displayName;
    group.members = (payload.members ?? []).map(m => {
      const user = authRepository.findById(tenantId, m.value);
      return { userId: m.value, displayName: m.display ?? user?.displayName ?? m.value };
    });
    group.updatedAt = new Date().toISOString();
    scimGroupRepository.save(tenantId, group);

    await auditService.log({
      tenantId,
      eventType: 'scim.group.update',
      actorId,
      actorName: actorId,
      targetId: group.groupId,
      targetType: 'group',
      outcome: 'success',
      metadata: { scimId },
    });

    return this.toScimGroup(group);
  }

  async deleteGroup(tenantId: string, scimId: string, actorId = 'scim-provisioner'): Promise<boolean> {
    const group = scimGroupRepository.findByScimId(tenantId, scimId) ?? scimGroupRepository.findById(tenantId, scimId);
    if (!group) return false;

    scimGroupRepository.delete(tenantId, group.groupId);

    await auditService.log({
      tenantId,
      eventType: 'scim.group.delete',
      actorId,
      actorName: actorId,
      targetId: group.groupId,
      targetType: 'group',
      outcome: 'success',
      metadata: { scimId, displayName: group.displayName },
    });

    return true;
  }

  // ── Service Provider Configuration ───────────────────────────────────────

  getServiceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://idvize.io/docs/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        { type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'Authentication scheme using the OAuth Bearer Token standard' },
      ],
      meta: { resourceType: 'ServiceProviderConfig', location: '/security/scim/v2/ServiceProviderConfig' },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private inferRolesFromGroups(groupNames: string[]): UserRole[] {
    const roles: UserRole[] = [];
    const lower = groupNames.map(g => g.toLowerCase());
    if (lower.some(g => g.includes('manager') || g.includes('program'))) roles.push('Manager');
    if (lower.some(g => g.includes('architect'))) roles.push('Architect');
    if (lower.some(g => g.includes('analyst'))) roles.push('BusinessAnalyst');
    if (lower.some(g => g.includes('engineer'))) roles.push('Engineer');
    if (lower.some(g => g.includes('developer') || g.includes('dev'))) roles.push('Developer');
    return roles.length > 0 ? roles : ['Developer']; // default role
  }
}

export const scimService = new ScimService();
