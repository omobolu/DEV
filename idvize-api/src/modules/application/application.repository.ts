import { Application, ApplicationQuery } from './application.types';

/**
 * In-memory application repository — Multi-Tenant.
 * Partitioned by tenantId: each tenant has its own application store.
 * Phase 2: Replace with PostgreSQL via TypeORM or Prisma.
 */
class ApplicationRepository {
  // tenantId → appId → Application
  private store = new Map<string, Map<string, Application>>();
  // tenantId → dedupeKey → appId
  private dedupeIndex = new Map<string, Map<string, string>>();

  private appBucket(tenantId: string): Map<string, Application> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  private dedupeBucket(tenantId: string): Map<string, string> {
    if (!this.dedupeIndex.has(tenantId)) this.dedupeIndex.set(tenantId, new Map());
    return this.dedupeIndex.get(tenantId)!;
  }

  // ─── Write ──────────────────────────────────────────────────────────────────

  save(tenantId: string, app: Application): Application {
    this.appBucket(tenantId).set(app.appId, app);
    return app;
  }

  saveMany(tenantId: string, apps: Application[]): Application[] {
    for (const app of apps) this.save(tenantId, app);
    return apps;
  }

  update(tenantId: string, appId: string, patch: Partial<Application>): Application | null {
    const bucket = this.appBucket(tenantId);
    const existing = bucket.get(appId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, appId, updatedAt: new Date().toISOString() };
    bucket.set(appId, updated);
    return updated;
  }

  // ─── Deduplication ──────────────────────────────────────────────────────────

  isDuplicate(tenantId: string, dedupeKey: string): boolean {
    return this.dedupeBucket(tenantId).has(dedupeKey);
  }

  registerDedupeKey(tenantId: string, dedupeKey: string, appId: string): void {
    this.dedupeBucket(tenantId).set(dedupeKey, appId);
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  findById(tenantId: string, appId: string): Application | undefined {
    return this.appBucket(tenantId).get(appId);
  }

  findAll(tenantId: string, query?: ApplicationQuery): Application[] {
    let apps = Array.from(this.appBucket(tenantId).values());

    if (!query) return apps;

    if (query.riskTier) {
      apps = apps.filter(a => a.riskTier === query.riskTier);
    }
    if (query.department) {
      apps = apps.filter(a => a.department.toLowerCase().includes(query.department!.toLowerCase()));
    }
    if (query.hasSso !== undefined && query.hasSso !== null) {
      apps = apps.filter(a => a.iamPosture?.ssoEnabled === query.hasSso);
    }
    if (query.hasMfa !== undefined && query.hasMfa !== null) {
      apps = apps.filter(a => a.iamPosture?.mfaEnforced === query.hasMfa);
    }
    if (query.missingControl) {
      apps = apps.filter(a => a.iamPosture?.missingControls.includes(query.missingControl!));
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      apps = apps.filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.vendor.toLowerCase().includes(s) ||
        a.owner.toLowerCase().includes(s) ||
        a.department.toLowerCase().includes(s)
      );
    }

    // Pagination
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 100;
    const start = (page - 1) * limit;
    return apps.slice(start, start + limit);
  }

  count(tenantId: string): number {
    return this.appBucket(tenantId).size;
  }

  clear(tenantId: string): void {
    this.appBucket(tenantId).clear();
    this.dedupeBucket(tenantId).clear();
  }
}

// Singleton
export const applicationRepository = new ApplicationRepository();
