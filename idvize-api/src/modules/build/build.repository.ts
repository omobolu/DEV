import { BuildJob, BuildSummary } from './build.types';

class BuildRepository {
  private store = new Map<string, Map<string, BuildJob>>();

  private bucket(tenantId: string): Map<string, BuildJob> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, job: BuildJob): BuildJob {
    this.bucket(tenantId).set(job.buildId, job);
    return job;
  }

  findById(tenantId: string, buildId: string): BuildJob | undefined {
    return this.bucket(tenantId).get(buildId);
  }

  findByAppId(tenantId: string, appId: string): BuildJob[] {
    return Array.from(this.bucket(tenantId).values()).filter(j => j.appId === appId);
  }

  findAll(tenantId: string, filters?: { state?: string; platform?: string; appId?: string }): BuildJob[] {
    let jobs = Array.from(this.bucket(tenantId).values());
    if (filters?.state) jobs = jobs.filter(j => j.state === filters.state);
    if (filters?.platform) jobs = jobs.filter(j => j.platform === filters.platform);
    if (filters?.appId) jobs = jobs.filter(j => j.appId === filters.appId);
    return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  toSummary(job: BuildJob): BuildSummary {
    return {
      buildId: job.buildId,
      appId: job.appId,
      appName: job.appName,
      buildType: job.buildType,
      platform: job.platform,
      state: job.state,
      priority: job.priority,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const buildRepository = new BuildRepository();
