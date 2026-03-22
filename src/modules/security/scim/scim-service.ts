/**
 * IDVIZE SCIM 2.0 Service
 * Scaffolding for automatic provisioning and deprovisioning
 */

import type { User, UserRole, GroupMapping } from '../../../types/security'
import { recordAudit } from '../../../types/audit'
import { authService } from '../auth/auth-service'

export interface ScimUser {
  schemas: string[]
  id?: string
  externalId?: string
  userName: string
  displayName: string
  name?: {
    givenName: string
    familyName: string
  }
  emails?: Array<{ value: string; type: string; primary: boolean }>
  active: boolean
  groups?: Array<{ value: string; display: string }>
}

export interface ScimGroup {
  schemas: string[]
  id: string
  displayName: string
  members: Array<{ value: string; display: string }>
}

export interface ScimListResponse<T> {
  schemas: string[]
  totalResults: number
  startIndex: number
  itemsPerPage: number
  Resources: T[]
}

/** In-memory group mappings */
const groupMappings: GroupMapping[] = [
  { id: 'gm-1', externalGroupId: 'okta-iam-managers', externalGroupName: 'IAM Managers', roles: ['manager'], source: 'okta' },
  { id: 'gm-2', externalGroupId: 'okta-iam-architects', externalGroupName: 'IAM Architects', roles: ['architect'], source: 'okta' },
  { id: 'gm-3', externalGroupId: 'okta-iam-analysts', externalGroupName: 'IAM Business Analysts', roles: ['business_analyst'], source: 'okta' },
  { id: 'gm-4', externalGroupId: 'okta-iam-engineers', externalGroupName: 'IAM Engineers', roles: ['engineer'], source: 'okta' },
  { id: 'gm-5', externalGroupId: 'okta-iam-developers', externalGroupName: 'IAM Developers', roles: ['developer'], source: 'okta' },
  { id: 'gm-6', externalGroupId: 'entra-iam-admins', externalGroupName: 'IAM Platform Admins', roles: ['admin'], source: 'entra' },
]

export class ScimService {
  private readonly scimSchemas = ['urn:ietf:params:scim:schemas:core:2.0:User']

  /** Provision (create) a user via SCIM */
  provisionUser(scimUser: ScimUser): ScimUser {
    const userId = `user-scim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const email = scimUser.emails?.find(e => e.primary)?.value ?? scimUser.userName
    const roles = this.resolveRolesFromGroups(scimUser.groups?.map(g => g.value) ?? [])

    const user: User = {
      id: userId,
      email,
      displayName: scimUser.displayName ?? scimUser.userName,
      roles: roles.length > 0 ? roles : ['developer'],
      active: scimUser.active,
      createdAt: new Date().toISOString(),
      scimExternalId: scimUser.externalId,
      attributes: {},
    }

    authService.upsertUser(user)

    recordAudit(
      'scim_event',
      { type: 'scim', id: 'scim-service', name: 'SCIM Provisioning' },
      'user_provisioned',
      userId,
      'success',
      { email, roles: roles.join(','), externalId: scimUser.externalId },
    )

    return {
      ...scimUser,
      schemas: this.scimSchemas,
      id: userId,
    }
  }

  /** Update a user via SCIM */
  updateUser(userId: string, scimUser: Partial<ScimUser>): ScimUser | null {
    const existingUser = authService.getUserById(userId)
    if (!existingUser) return null

    if (scimUser.displayName) existingUser.displayName = scimUser.displayName
    if (scimUser.active !== undefined) existingUser.active = scimUser.active
    if (scimUser.emails) {
      const primaryEmail = scimUser.emails.find(e => e.primary)
      if (primaryEmail) existingUser.email = primaryEmail.value
    }
    if (scimUser.groups) {
      const roles = this.resolveRolesFromGroups(scimUser.groups.map(g => g.value))
      if (roles.length > 0) existingUser.roles = roles
    }

    authService.upsertUser(existingUser)

    recordAudit(
      'scim_event',
      { type: 'scim', id: 'scim-service', name: 'SCIM Update' },
      'user_updated',
      userId,
      'success',
      { updatedFields: Object.keys(scimUser).join(',') },
    )

    return {
      schemas: this.scimSchemas,
      id: userId,
      userName: existingUser.email,
      displayName: existingUser.displayName,
      active: existingUser.active,
      externalId: existingUser.scimExternalId,
    }
  }

  /** Deprovision (deactivate) a user via SCIM */
  deprovisionUser(userId: string): boolean {
    const success = authService.deactivateUser(userId)

    recordAudit(
      'scim_event',
      { type: 'scim', id: 'scim-service', name: 'SCIM Deprovisioning' },
      'user_deprovisioned',
      userId,
      success ? 'success' : 'failure',
      {},
    )

    return success
  }

  /** List users (SCIM format) */
  listUsers(startIndex = 1, count = 100): ScimListResponse<ScimUser> {
    const users = authService.getUsers()
    const scimUsers: ScimUser[] = users.map(u => ({
      schemas: this.scimSchemas,
      id: u.id,
      externalId: u.scimExternalId,
      userName: u.email,
      displayName: u.displayName,
      active: u.active,
    }))

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: scimUsers.length,
      startIndex,
      itemsPerPage: count,
      Resources: scimUsers.slice(startIndex - 1, startIndex - 1 + count),
    }
  }

  /** Get group mappings */
  getGroupMappings(): GroupMapping[] {
    return [...groupMappings]
  }

  /** Add or update a group mapping */
  upsertGroupMapping(mapping: GroupMapping): void {
    const existing = groupMappings.findIndex(m => m.id === mapping.id)
    if (existing >= 0) {
      groupMappings[existing] = mapping
    } else {
      groupMappings.push(mapping)
    }
  }

  private resolveRolesFromGroups(groupIds: string[]): UserRole[] {
    const roles = new Set<UserRole>()
    for (const groupId of groupIds) {
      const mapping = groupMappings.find(m => m.externalGroupId === groupId)
      if (mapping) {
        for (const role of mapping.roles) roles.add(role)
      }
    }
    return Array.from(roles)
  }
}

/** Singleton SCIM service */
export const scimService = new ScimService()
