import { ControlEvaluationResult } from './control.types';
import { Application } from '../application/application.types';
import { iamCorrelationEngine } from '../application/engines/iam-correlation.engine';
import { controlDetectionEngine } from './engines/control-detection.engine';
import { applicationService } from '../application/application.service';
import { applicationRepository } from '../application/application.repository';

// In-memory control evaluation cache
const controlCache = new Map<string, ControlEvaluationResult>();

export class ControlService {

  /**
   * Evaluate all IAM controls for a single application.
   * Runs IAM correlation + control detection, caches result, attaches posture to app.
   */
  async evaluateApp(tenantId: string, appId: string, forceRefresh = false): Promise<ControlEvaluationResult | null> {
    if (!forceRefresh && controlCache.has(appId)) {
      return controlCache.get(appId)!;
    }

    const app = applicationRepository.findById(tenantId, appId);
    if (!app) return null;

    // Step 1: Correlate with IAM platforms
    const posture = await iamCorrelationEngine.correlate(app);

    // Step 2: Attach posture to app record
    applicationService.attachPosture(tenantId, appId, posture);

    // Step 3: Evaluate controls
    const result = controlDetectionEngine.evaluate(app, posture);

    // Cache
    controlCache.set(appId, result);

    return result;
  }

  /**
   * Evaluate controls for all applications.
   */
  async evaluateAll(tenantId: string): Promise<ControlEvaluationResult[]> {
    const { apps } = applicationService.listApplications(tenantId);
    const results: ControlEvaluationResult[] = [];

    for (const app of apps) {
      const result = await this.evaluateApp(tenantId, app.appId, true);
      if (result) results.push(result);
    }

    return results;
  }

  getFromCache(appId: string): ControlEvaluationResult | undefined {
    return controlCache.get(appId);
  }

  getCacheSummary(tenantId: string): { total: number; evaluated: number; withCriticalGaps: number } {
    const { apps, total } = applicationService.listApplications(tenantId);
    let withCriticalGaps = 0;

    for (const app of apps) {
      const cached = controlCache.get(app.appId);
      if (cached?.controls.some(c => !c.implemented && c.risk === 'critical')) {
        withCriticalGaps++;
      }
    }

    return { total, evaluated: controlCache.size, withCriticalGaps };
  }
}

export const controlService = new ControlService();
