/**
 * Auth / User Repository
 *
 * In-memory store for IDVIZE platform users.
 * Phase 2: replace with PostgreSQL via Prisma or TypeORM.
 *
 * Seeded with one demo user per role for development.
 */

import { User, UserRole } from '../security.types';

const now = new Date().toISOString();

const SEED_USERS: User[] = [
  {
    userId: 'usr-manager-001',
    username: 'admin@idvize.com',
    displayName: 'Alex Morgan',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'admin@idvize.com',
    department: 'IAM Program Office',
    title: 'IAM Program Manager',
    roles: ['Manager'],
    groups: ['grp-managers'],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: true,
    passwordHash: 'password123', // mock plaintext — Phase 2: hash + IdP delegation
    attributes: { costCentre: 'IAM-001', clearanceLevel: 'high' },
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: 'usr-architect-001',
    username: 'sarah.architect@idvize.com',
    displayName: 'Sarah Chen',
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.architect@idvize.com',
    department: 'IAM Architecture',
    title: 'Senior IAM Architect',
    roles: ['Architect'],
    groups: ['grp-architects'],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: true,
    passwordHash: 'password123',
    attributes: { costCentre: 'IAM-002', clearanceLevel: 'high' },
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: 'usr-analyst-001',
    username: 'james.analyst@idvize.com',
    displayName: 'James Okafor',
    firstName: 'James',
    lastName: 'Okafor',
    email: 'james.analyst@idvize.com',
    department: 'IAM Business Analysis',
    title: 'IAM Business Analyst',
    roles: ['BusinessAnalyst'],
    groups: ['grp-analysts'],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: true,
    passwordHash: 'password123',
    attributes: { costCentre: 'IAM-003', clearanceLevel: 'medium' },
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: 'usr-engineer-001',
    username: 'lisa.engineer@idvize.com',
    displayName: 'Lisa Park',
    firstName: 'Lisa',
    lastName: 'Park',
    email: 'lisa.engineer@idvize.com',
    department: 'IAM Engineering',
    title: 'IAM Engineer',
    roles: ['Engineer'],
    groups: ['grp-engineers'],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: true,
    passwordHash: 'password123',
    attributes: { costCentre: 'IAM-004', clearanceLevel: 'medium' },
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: 'usr-developer-001',
    username: 'raj.developer@idvize.com',
    displayName: 'Raj Patel',
    firstName: 'Raj',
    lastName: 'Patel',
    email: 'raj.developer@idvize.com',
    department: 'IAM Engineering',
    title: 'IAM Developer',
    roles: ['Developer'],
    groups: ['grp-developers'],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: false,
    passwordHash: 'password123',
    attributes: { costCentre: 'IAM-005', clearanceLevel: 'standard' },
    createdAt: now,
    updatedAt: now,
  },
];

class AuthRepository {
  private store = new Map<string, User>();
  private byUsername = new Map<string, string>(); // username → userId

  constructor() {
    SEED_USERS.forEach(u => this.save(u));
  }

  save(user: User): User {
    this.store.set(user.userId, user);
    this.byUsername.set(user.username.toLowerCase(), user.userId);
    return user;
  }

  findById(userId: string): User | undefined {
    return this.store.get(userId);
  }

  findByUsername(username: string): User | undefined {
    const id = this.byUsername.get(username.toLowerCase());
    return id ? this.store.get(id) : undefined;
  }

  findAll(): User[] {
    return Array.from(this.store.values());
  }

  findByRole(role: UserRole): User[] {
    return this.findAll().filter(u => u.roles.includes(role));
  }

  count(): number {
    return this.store.size;
  }

  updateLastLogin(userId: string): void {
    const user = this.store.get(userId);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
  }
}

export const authRepository = new AuthRepository();
