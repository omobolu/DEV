import { Application, ApplicationQuery } from './application.types';

/**
 * In-memory application repository.
 * Phase 2: Replace with PostgreSQL via TypeORM or Prisma.
 */
class ApplicationRepository {
  private store = new Map<string, Application>();
  private dedupeIndex = new Map<string, string>(); // dedupeKey → appId

  // ─── Write ──────────────────────────────────────────────────────────────────

  save(app: Application): Application {
    this.store.set(app.appId, app);
    return app;
  }

  saveMany(apps: Application[]): Application[] {
    for (const app of apps) this.save(app);
    return apps;
  }

  update(appId: string, patch: Partial<Application>): Application | null {
    const existing = this.store.get(appId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, appId, updatedAt: new Date().toISOString() };
    this.store.set(appId, updated);
    return updated;
  }

  // ─── Deduplication ──────────────────────────────────────────────────────────

  isDuplicate(dedupeKey: string): boolean {
    return this.dedupeIndex.has(dedupeKey);
  }

  registerDedupeKey(dedupeKey: string, appId: string): void {
    this.dedupeIndex.set(dedupeKey, appId);
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  findById(appId: string): Application | undefined {
    return this.store.get(appId);
  }

  findAll(query?: ApplicationQuery): Application[] {
    let apps = Array.from(this.store.values());

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
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const start = (page - 1) * limit;
    return apps.slice(start, start + limit);
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
    this.dedupeIndex.clear();
  }
}

// Singleton
export const applicationRepository = new ApplicationRepository();
