/**
 * IDVIZE Authentication Service
 * SSO integration scaffolding for Okta and Microsoft Entra
 */

import type { User } from '../../../types/security'
import { recordAudit } from '../../../types/audit'

export type AuthProvider = 'okta' | 'entra' | 'local'

export interface AuthConfig {
  provider: AuthProvider
  clientId?: string
  issuer?: string
  redirectUri?: string
  scopes?: string[]
}

export interface AuthSession {
  sessionId: string
  userId: string
  user: User
  provider: AuthProvider
  issuedAt: string
  expiresAt: string
  active: boolean
}

export interface AuthResult {
  success: boolean
  session?: AuthSession
  error?: string
}

/** In-memory user store for v1 */
const users: Map<string, User> = new Map()
const sessions: Map<string, AuthSession> = new Map()

// Seed default demo users
const defaultUsers: User[] = [
  {
    id: 'user-manager-001',
    email: 'sarah.manager@idvize.com',
    displayName: 'Sarah Manager',
    roles: ['manager'],
    department: 'IAM Operations',
    title: 'IAM Program Manager',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
  {
    id: 'user-architect-001',
    email: 'james.architect@idvize.com',
    displayName: 'James Architect',
    roles: ['architect'],
    department: 'IAM Architecture',
    title: 'Senior IAM Architect',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
  {
    id: 'user-analyst-001',
    email: 'lisa.analyst@idvize.com',
    displayName: 'Lisa Analyst',
    roles: ['business_analyst'],
    department: 'IAM Operations',
    title: 'IAM Business Analyst',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
  {
    id: 'user-engineer-001',
    email: 'mike.engineer@idvize.com',
    displayName: 'Mike Engineer',
    roles: ['engineer'],
    department: 'IAM Engineering',
    title: 'IAM Engineer',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
  {
    id: 'user-developer-001',
    email: 'alex.developer@idvize.com',
    displayName: 'Alex Developer',
    roles: ['developer'],
    department: 'IAM Development',
    title: 'IAM Developer',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
  {
    id: 'user-admin-001',
    email: 'admin@idvize.com',
    displayName: 'Platform Admin',
    roles: ['admin'],
    department: 'IT',
    title: 'Platform Administrator',
    active: true,
    createdAt: new Date().toISOString(),
    attributes: {},
  },
]

// Initialize default users
for (const u of defaultUsers) {
  users.set(u.id, u)
}

export class AuthService {
  private config: AuthConfig

  constructor(config: AuthConfig = { provider: 'local' }) {
    this.config = config
  }

  /** Authenticate a user (local mode for v1) */
  async authenticate(email: string): Promise<AuthResult> {
    const user = this.findUserByEmail(email)
    if (!user) {
      recordAudit(
        'authentication',
        { type: 'system', id: 'auth-service', name: 'AuthService' },
        'login_attempt',
        email,
        'failure',
        { reason: 'User not found', provider: this.config.provider },
        'warning',
      )
      return { success: false, error: 'User not found' }
    }

    if (!user.active) {
      recordAudit(
        'authentication',
        { type: 'user', id: user.id, name: user.displayName },
        'login_attempt',
        email,
        'denied',
        { reason: 'Account disabled', provider: this.config.provider },
        'warning',
      )
      return { success: false, error: 'Account is disabled' }
    }

    const session = this.createSession(user)

    recordAudit(
      'authentication',
      { type: 'user', id: user.id, name: user.displayName, roles: user.roles },
      'login_success',
      email,
      'success',
      { provider: this.config.provider, sessionId: session.sessionId },
    )

    return { success: true, session }
  }

  /** Validate an existing session */
  validateSession(sessionId: string): AuthSession | null {
    const session = sessions.get(sessionId)
    if (!session) return null
    if (!session.active) return null
    if (new Date(session.expiresAt) < new Date()) {
      session.active = false
      return null
    }
    return session
  }

  /** Logout / invalidate session */
  logout(sessionId: string): void {
    const session = sessions.get(sessionId)
    if (session) {
      session.active = false
      recordAudit(
        'authentication',
        { type: 'user', id: session.userId, name: session.user.displayName },
        'logout',
        session.userId,
        'success',
        { sessionId },
      )
    }
  }

  /** Get current config */
  getConfig(): AuthConfig {
    return { ...this.config }
  }

  /** Get all users */
  getUsers(): User[] {
    return Array.from(users.values())
  }

  /** Get user by ID */
  getUserById(id: string): User | undefined {
    return users.get(id)
  }

  /** Create or update a user (used by SCIM) */
  upsertUser(user: User): User {
    users.set(user.id, user)
    return user
  }

  /** Deactivate a user (used by SCIM) */
  deactivateUser(userId: string): boolean {
    const user = users.get(userId)
    if (!user) return false
    user.active = false
    // Invalidate all sessions
    for (const [, session] of sessions) {
      if (session.userId === userId) session.active = false
    }
    return true
  }

  private findUserByEmail(email: string): User | undefined {
    for (const user of users.values()) {
      if (user.email === email) return user
    }
    return undefined
  }

  private createSession(user: User): AuthSession {
    const session: AuthSession = {
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      user,
      provider: this.config.provider,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
      active: true,
    }
    sessions.set(session.sessionId, session)

    // Update last login
    user.lastLoginAt = new Date().toISOString()

    return session
  }
}

/** Singleton auth service */
export const authService = new AuthService()
