/**
 * MaturityService — orchestrates the full assessment pipeline:
 *   Collect Evidence → Normalize → Score → Explain → Recommend → Persist
 */

import { v4 as uuidv4 } from 'uuid';
import { MaturityAssessmentRun, MaturitySummaryResponse } from './maturity.types';
import { maturityEvidenceCollector }   from './services/evidence-collector.service';
import { maturityScoringEngine }       from './services/scoring-engine.service';
import { maturityExplainabilityService } from './services/explainability.service';
import { maturityRecommendationAgent } from './services/recommendation-agent.service';
import { maturityRepository }          from './maturity.repository';
import { auditService }                from '../security/audit/audit.service';

class MaturityService {
  private runInProgress = false;

  async runAssessment(triggeredBy = 'system'): Promise<MaturityAssessmentRun> {
    if (this.runInProgress) {
      throw new Error('An assessment is already in progress');
    }
    this.runInProgress = true;
    const startedAt = new Date().toISOString();
    const runId = uuidv4();

    try {
      console.log(`[Maturity] Assessment started runId=${runId} by=${triggeredBy}`);

      // 1. Collect evidence
      const evidence = await maturityEvidenceCollector.collect();
      const lowConfEvidence = evidence.filter(e => e.quality === 'missing' || e.quality === 'mock');

      // 2. Score
      const score = maturityScoringEngine.calculate(evidence);

      // 3. Explain
      const explanations = maturityExplainabilityService.explain(score);

      // 4. Recommend (+ AI narrative if API key available)
      const { recommendations, aiNarrative } = await maturityRecommendationAgent.generate(score);

      const completedAt = new Date().toISOString();
      const run: MaturityAssessmentRun = {
        runId,
        triggeredBy,
        triggeredAt:   startedAt,
        completedAt,
        score,
        recommendations,
        explanations,
        aiNarrative,
        evidenceCount:      evidence.length,
        lowConfidenceCount: lowConfEvidence.length,
      };

      maturityRepository.save(run);

      auditService.log({
        eventType: 'authz.allow',
        actorId:   triggeredBy,
        actorName: triggeredBy,
        resource:  '/maturity/recalculate',
        outcome:   'success',
        reason:    `Assessment completed: overall=${score.overall} level=${score.level}`,
        metadata:  { runId, overall: score.overall, level: score.level, evidenceCount: evidence.length },
      });

      console.log(`[Maturity] Assessment complete runId=${runId} overall=${score.overall} (${score.level}) confidence=${score.confidence}`);
      return run;

    } finally {
      this.runInProgress = false;
    }
  }

  getLatestRun(): MaturityAssessmentRun | undefined {
    return maturityRepository.latest();
  }

  async getOrRunAssessment(): Promise<MaturityAssessmentRun> {
    return this.getLatestRun() ?? this.runAssessment('auto');
  }

  buildSummary(run: MaturityAssessmentRun): MaturitySummaryResponse {
    return {
      runId:         run.runId,
      overall:       run.score.overall,
      level:         run.score.level,
      confidence:    run.score.confidence,
      triggeredAt:   run.triggeredAt,
      domains:       run.score.domains.map(d => ({
        domainId:   d.domainId,
        name:       d.name,
        score:      d.score,
        level:      d.level,
        confidence: d.confidence,
        trend:      d.trend,
      })),
      topRecommendations: run.recommendations.slice(0, 5),
      aiNarrative:   run.aiNarrative,
    };
  }
}

export const maturityService = new MaturityService();
