/**
 * MaturityRecommendationAgent
 *
 * Generates prioritised recommendations from domain scores.
 * The deterministic layer always runs first — it produces structured
 * recommendations based on score bands and known gaps.
 *
 * If ANTHROPIC_API_KEY is set, Claude is called with the full scoring
 * context and asked to enrich with narrative, nuance, and novel insights.
 * Claude is NEVER asked to set scores — only to explain and recommend
 * based on provided evidence.
 */

import { MaturityScore, MaturityDomainScore, MaturityRecommendation } from '../maturity.types';
import { runSimpleAnalysis } from '../../../services/claude.service';

// ── Deterministic recommendation rules ────────────────────────────────────────

interface RuleInput {
  domain: MaturityDomainScore;
}

function rulesForDomain({ domain }: RuleInput): MaturityRecommendation[] {
  const recs: MaturityRecommendation[] = [];
  const { domainId, name, score, indicators } = domain;

  const weak = indicators.filter(i => i.score < 40);
  const medium = indicators.filter(i => i.score >= 40 && i.score < 60);

  // Global rule: any domain below 30 = Critical recommendation
  if (score < 30) {
    recs.push({
      domainId, domainName: name,
      priority: 'critical',
      title:  `Urgent: Establish ${name} Foundation`,
      description: `${name} is at Initial maturity (${score}/100). Immediate action needed to define processes, assign ownership, and implement basic controls.`,
      effort:  'medium_term',
      impact:  30,
    });
  }

  // Per-indicator weak spots
  for (const ind of weak) {
    const priority = ind.score < 20 ? 'critical' : 'high';
    recs.push({
      domainId, domainName: name,
      priority,
      title:  `Improve ${ind.name}`,
      description: `${ind.name} scored ${ind.score}/100. ${ind.rationale}. Focus on ${ind.sources.join(', ')} to gather evidence and close gaps.`,
      effort:  ind.score < 20 ? 'medium_term' : 'quick_win',
      impact:  Math.round((60 - ind.score) * ind.weight * 0.8),
    });
  }

  for (const ind of medium) {
    recs.push({
      domainId, domainName: name,
      priority: 'medium',
      title:  `Strengthen ${ind.name}`,
      description: `${ind.name} is Developing (${ind.score}/100). Formalise processes and increase coverage to reach Defined maturity.`,
      effort:  'medium_term',
      impact:  Math.round((70 - ind.score) * ind.weight * 0.5),
    });
  }

  return recs;
}

export class MaturityRecommendationAgent {

  async generate(score: MaturityScore): Promise<{ recommendations: MaturityRecommendation[]; aiNarrative?: string }> {
    // Step 1: Deterministic recommendations from all domains
    const allRecs: MaturityRecommendation[] = score.domains.flatMap(d =>
      rulesForDomain({ domain: d })
    );

    // Deduplicate and sort: critical > high > medium > low, then by impact desc
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allRecs.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] || b.impact - a.impact
    );

    const topRecs = allRecs.slice(0, 15);

    // Step 2: AI narrative enrichment (if API key available)
    const aiNarrative = await this.getAiNarrative(score, topRecs);

    return { recommendations: topRecs, aiNarrative };
  }

  private async getAiNarrative(
    score: MaturityScore,
    recs: MaturityRecommendation[],
  ): Promise<string | undefined> {
    try {
      const domainSummary = score.domains.map(d =>
        `  ${d.name}: ${d.score}/100 (${d.level}, conf ${Math.round(d.confidence * 100)}%) — gaps: ${d.topGaps.join(', ')}`
      ).join('\n');

      const recSummary = recs.slice(0, 5).map(r =>
        `  [${r.priority.toUpperCase()}] ${r.title} — ${r.description}`
      ).join('\n');

      const system = `You are an expert IAM programme maturity advisor. You interpret scoring evidence and provide concise, evidence-grounded strategic recommendations. You do NOT set or adjust scores — scores are calculated deterministically by the system. Your role is to explain, prioritise, and recommend based on the data provided.`;

      const user = `The IAM programme maturity assessment has completed. Here is the scoring context:

OVERALL: ${score.overall}/100 (${score.level}, confidence ${Math.round(score.confidence * 100)}%)

DOMAIN SCORES:
${domainSummary}

TOP DETERMINISTIC RECOMMENDATIONS:
${recSummary}

Please provide a concise (3-4 paragraph) executive narrative that:
1. Summarises the overall IAM programme maturity and what it means for the organisation
2. Highlights the 2-3 most critical areas needing immediate attention and why
3. Identifies any patterns or systemic issues across domains
4. Suggests a strategic roadmap priority for the next 90 days

Base your narrative strictly on the scores and gaps provided. Flag any areas where confidence is low and caution is warranted.`;

      const result = await runSimpleAnalysis(system, user);
      return result.narrative;
    } catch {
      return undefined; // AI unavailable — deterministic recs still provided
    }
  }
}

export const maturityRecommendationAgent = new MaturityRecommendationAgent();
