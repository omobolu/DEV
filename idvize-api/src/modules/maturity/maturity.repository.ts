/**
 * MaturityRepository — in-memory store for assessment run history.
 * Keeps the last 20 runs. Structured for future DB persistence.
 */

import { MaturityAssessmentRun } from './maturity.types';

class MaturityRepository {
  private store: MaturityAssessmentRun[] = [];
  private readonly MAX_HISTORY = 20;

  save(run: MaturityAssessmentRun): MaturityAssessmentRun {
    this.store.unshift(run); // newest first
    if (this.store.length > this.MAX_HISTORY) {
      this.store = this.store.slice(0, this.MAX_HISTORY);
    }
    return run;
  }

  latest(): MaturityAssessmentRun | undefined {
    return this.store[0];
  }

  history(): MaturityAssessmentRun[] {
    return [...this.store];
  }

  findById(runId: string): MaturityAssessmentRun | undefined {
    return this.store.find(r => r.runId === runId);
  }

  count(): number {
    return this.store.length;
  }
}

export const maturityRepository = new MaturityRepository();
