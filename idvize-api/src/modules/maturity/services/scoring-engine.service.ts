/**
 * MaturityScoringEngine
 *
 * Deterministic, auditable scoring of all domains and overall programme maturity.
 *
 * Algorithm (per domain):
 *   weightedSum      = Σ (indicator.score × indicator.weight × indicator.confidence)
 *   effectiveWeight  = Σ (indicator.weight × indicator.confidence)
 *   domainScore      = weightedSum / effectiveWeight
 *
 *   domainConfidence = weightedSum_conf / total_weight
 *     where weightedSum_conf = Σ (indicator.confidence × indicator.weight)
 *
 * Overall score:
 *   overallScore     = Σ (domain.score × domain.weight) / Σ domain.weight
 *   overallConf      = Σ (domain.confidence × domain.weight) / Σ domain.weight
 *
 * Low-confidence indicators do NOT silently inflate the score — they reduce
 * effectiveWeight, pulling the domain score closer to a conservative baseline.
 */

import { MaturityEvidence, MaturityScore, MaturityDomainScore } from '../maturity.types';
import { MATURITY_DOMAINS, scoreToLevel } from '../maturity.domains';
import { maturityNormalizationService } from './normalization.service';

export class MaturityScoringEngine {

  calculate(evidence: MaturityEvidence[]): MaturityScore {
    const domainScores: MaturityDomainScore[] = MATURITY_DOMAINS.map(domainDef => {
      const indicators = domainDef.indicatorDefs.map(indDef =>
        maturityNormalizationService.normalize(indDef, domainDef.domainId, evidence)
      );

      // Weighted-confidence score: uncertain indicators contribute less weight
      let weightedSum     = 0;
      let effectiveWeight = 0;
      let confWeightedSum = 0;
      let totalWeight     = 0;

      for (const ind of indicators) {
        const w = ind.weight;
        const c = ind.confidence;
        weightedSum     += ind.score * w * c;
        effectiveWeight += w * c;
        confWeightedSum += c * w;
        totalWeight     += w;
      }

      const domainScore = effectiveWeight > 0
        ? weightedSum / effectiveWeight
        : 10;   // no valid evidence → Initial-floor

      const domainConfidence = totalWeight > 0
        ? confWeightedSum / totalWeight
        : 0.1;

      // Top gaps: 3 lowest-scoring indicators
      const topGaps = [...indicators]
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(i => i.name);

      return {
        domainId:   domainDef.domainId,
        name:       domainDef.name,
        weight:     domainDef.weight,
        score:      Math.round(domainScore),
        level:      scoreToLevel(domainScore),
        confidence: Math.round(domainConfidence * 100) / 100,
        indicators,
        topGaps,
      };
    });

    // Overall score weighted by domain weight
    const totalDomainWeight = domainScores.reduce((s, d) => s + d.weight, 0);
    const overallWeighted   = domainScores.reduce((s, d) => s + d.score * d.weight, 0);
    const overallConf       = domainScores.reduce((s, d) => s + d.confidence * d.weight, 0);

    const overall    = totalDomainWeight > 0 ? overallWeighted / totalDomainWeight : 0;
    const confidence = totalDomainWeight > 0 ? overallConf / totalDomainWeight : 0;

    return {
      overall:    Math.round(overall),
      level:      scoreToLevel(overall),
      confidence: Math.round(confidence * 100) / 100,
      domains:    domainScores,
    };
  }
}

export const maturityScoringEngine = new MaturityScoringEngine();
