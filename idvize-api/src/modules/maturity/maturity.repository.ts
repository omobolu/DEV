/**
 * MaturityRepository — in-memory store for assessment run history.
 * Keeps the last 20 runs per tenant. Structured for future DB persistence.
 */

import { MaturityAssessmentRun } from './maturity.types';

class MaturityRepository {
  private log = new Map<string, MaturityAssessmentRun[]>();
  private readonly MAX_HISTORY = 20;

  private bucket(tenantId: string): MaturityAssessmentRun[] {
    if (!this.log.has(tenantId)) this.log.set(tenantId, []);
    return this.log.get(tenantId)!;
  }

  save(tenantId: string, run: MaturityAssessmentRun): MaturityAssessmentRun {
    const bucket = this.bucket(tenantId);
    bucket.unshift(run); // newest first
    if (bucket.length > this.MAX_HISTORY) {
      bucket.splice(this.MAX_HISTORY);
    }
    return run;
  }

  latest(tenantId: string): MaturityAssessmentRun | undefined {
    return this.bucket(tenantId)[0];
  }

  history(tenantId: string): MaturityAssessmentRun[] {
    return [...this.bucket(tenantId)];
  }

  findById(tenantId: string, runId: string): MaturityAssessmentRun | undefined {
    return this.bucket(tenantId).find(r => r.runId === runId);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).length;
  }
}

export const maturityRepository = new MaturityRepository();
