/**
 * MaturityExplainabilityService
 *
 * Builds human-readable audit trails for every domain score.
 * Purely deterministic — no AI. Shows exactly how each score was derived.
 */

import { MaturityScore, MaturityExplanation, MaturityDomainScore } from '../maturity.types';

export class MaturityExplainabilityService {

  explain(score: MaturityScore): MaturityExplanation[] {
    return score.domains.map(d => this.explainDomain(d));
  }

  private explainDomain(domain: MaturityDomainScore): MaturityExplanation {
    const keyFactors: string[] = [];
    const limitations: string[] = [];

    for (const ind of domain.indicators) {
      keyFactors.push(
        `${ind.name}: ${ind.score}/100 (weight ${ind.weight}, confidence ${Math.round(ind.confidence * 100)}%) — ${ind.rationale}`
      );
      if (ind.confidence < 0.5) {
        limitations.push(`⚠ ${ind.name}: low confidence (${Math.round(ind.confidence * 100)}%) — evidence is mock or missing. Score may not reflect reality.`);
      }
      if (ind.evidenceItems.every(e => e.quality === 'missing')) {
        limitations.push(`✗ ${ind.name}: no evidence collected. Defaulted to Initial-floor score of ${ind.score}.`);
      }
    }

    const topIndicator = [...domain.indicators].sort((a, b) => b.score - a.score)[0];
    const weakIndicator = [...domain.indicators].sort((a, b) => a.score - b.score)[0];

    const narrative = [
      `Domain "${domain.name}" scored ${domain.score}/100 (${domain.level}, confidence ${Math.round(domain.confidence * 100)}%).`,
      topIndicator  ? `Strongest indicator: ${topIndicator.name} (${topIndicator.score}/100).` : '',
      weakIndicator ? `Weakest indicator: ${weakIndicator.name} (${weakIndicator.score}/100) — ${weakIndicator.rationale}.` : '',
      domain.confidence < 0.6
        ? `Confidence is LOW (${Math.round(domain.confidence * 100)}%). Several indicators rely on mock or missing evidence. Treat this score as a lower-bound estimate.`
        : `Confidence is ACCEPTABLE (${Math.round(domain.confidence * 100)}%). Score is based on real evidence.`,
    ].filter(Boolean).join(' ');

    return {
      domainId:    domain.domainId,
      narrative,
      keyFactors,
      limitations,
    };
  }
}

export const maturityExplainabilityService = new MaturityExplainabilityService();
