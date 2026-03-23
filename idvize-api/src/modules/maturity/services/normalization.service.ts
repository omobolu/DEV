/**
 * MaturityNormalizationService
 *
 * Converts raw evidence into a normalised 0–100 score and a 0–1 confidence
 * for each indicator. Rules are explicit and deterministic.
 *
 * Confidence rules:
 *   - 'live'      evidence → full weight
 *   - 'mock'      evidence → 0.4 confidence (uncertain; should not inflate score)
 *   - 'estimated' evidence → 0.6 confidence
 *   - 'missing'   evidence → 0.1 confidence; score defaults to 10 (Initial-floor)
 *
 * If an indicator has ONLY missing evidence, confidence = 0.1 and score = 5.
 */

import { MaturityEvidence, MaturityIndicator, IndicatorDefinition } from '../maturity.types';

const QUALITY_CONFIDENCE: Record<string, number> = {
  live:      1.0,
  mock:      0.4,
  estimated: 0.6,
  missing:   0.1,
};

export class MaturityNormalizationService {

  normalize(
    def: IndicatorDefinition,
    domainId: string,
    evidence: MaturityEvidence[],
  ): MaturityIndicator {
    const relevant = evidence.filter(e => e.indicatorId === def.indicatorId);

    if (relevant.length === 0) {
      return this.missingIndicator(def, domainId);
    }

    // Average confidence weighted by quality
    const avgConfidence = relevant.reduce((s, e) => s + QUALITY_CONFIDENCE[e.quality], 0) / relevant.length;

    // Dispatch to indicator-specific scorer
    const { score, rationale } = this.scoreIndicator(def.indicatorId, relevant, avgConfidence);

    // Confidence penalty for no live evidence
    const hasLive = relevant.some(e => e.quality === 'live');
    const confidence = hasLive ? Math.min(avgConfidence, 1) : Math.min(avgConfidence * 0.7, 0.6);

    return {
      indicatorId:   def.indicatorId,
      domainId,
      name:          def.name,
      description:   def.description,
      weight:        def.weight,
      score:         Math.round(Math.max(0, Math.min(100, score))),
      confidence:    Math.round(confidence * 100) / 100,
      evidenceItems: relevant,
      rationale,
      sources:       def.sources,
    };
  }

  private missingIndicator(def: IndicatorDefinition, domainId: string): MaturityIndicator {
    return {
      indicatorId: def.indicatorId, domainId,
      name: def.name, description: def.description,
      weight: def.weight, score: 5, confidence: 0.1,
      evidenceItems: [],
      rationale: 'No evidence collected — defaulting to Initial floor (score=5, confidence=0.1)',
      sources: def.sources,
    };
  }

  // ── Per-indicator scoring rules ──────────────────────────────────────────────

  private scoreIndicator(
    id: string,
    evidence: MaturityEvidence[],
    confidence: number,
  ): { score: number; rationale: string } {

    const raw = (key: string) => {
      for (const e of evidence) {
        const v = (e.rawValue as Record<string,unknown>);
        if (v && key in v) return v[key];
      }
      return undefined;
    };

    const num = (key: string, fallback = 0): number => {
      const v = raw(key);
      return typeof v === 'number' ? v : fallback;
    };

    const rate = (numerator: string, denominator: string): number => {
      const n = num(numerator, 0);
      const d = num(denominator, 0);
      return d > 0 ? n / d : 0;
    };

    const isMock = evidence.every(e => e.quality === 'mock' || e.quality === 'missing');

    switch (id) {

      // ── Governance ────────────────────────────────────────────────────────
      case 'gov-charter': {
        const docs = num('govDocs');
        const score = docs >= 5 ? 80 : docs >= 3 ? 65 : docs >= 1 ? 45 : 15;
        return { score, rationale: `${docs} governance/policy documents → ${score}` };
      }
      case 'gov-roles': {
        const docs = num('procDocs');
        const score = docs >= 4 ? 75 : docs >= 2 ? 55 : docs >= 1 ? 40 : 15;
        return { score, rationale: `${docs} procedure/guideline documents → ${score}` };
      }
      case 'gov-budget': {
        const totalCost = num('totalCost');
        // If cost is tracked (>0), budget visibility exists
        const score = totalCost > 0 ? 75 : 20;
        return { score, rationale: `Cost tracking active ($${totalCost.toLocaleString()}) → ${score}` };
      }
      case 'gov-policies': {
        const published = num('publishedPolicies');
        const score = published >= 10 ? 85 : published >= 5 ? 70 : published >= 2 ? 50 : published >= 1 ? 35 : 10;
        return { score, rationale: `${published} published documents → ${score}` };
      }
      case 'gov-metrics': {
        const events = num('totalEvents');
        const score = events >= 100 ? 70 : events >= 20 ? 55 : events >= 5 ? 40 : 20;
        return { score, rationale: `${events} audit events as metrics proxy → ${score}` };
      }

      // ── IGA ───────────────────────────────────────────────────────────────
      case 'iga-jml': {
        const scimUsers = num('userCount') + num('scimManaged');
        const spSources = num('sources');
        const isLive    = evidence.some(e => e.quality === 'live');
        let score = 20;
        if (scimUsers > 50)  score = 65;
        else if (scimUsers > 10)  score = 55;
        else if (scimUsers > 0)   score = 45;
        if (spSources > 0) score = Math.min(score + 10, 80);
        if (!isLive) score = Math.min(score, 50);
        return { score, rationale: `${scimUsers} SCIM-managed users, ${spSources} SailPoint sources → ${score}` };
      }
      case 'iga-cert': {
        const cr = num('completionRate');
        const total = num('total');
        const score = total === 0 ? 15
          : cr >= 0.9 ? 85 : cr >= 0.7 ? 65 : cr >= 0.5 ? 50 : cr >= 0.3 ? 35 : 20;
        return { score, rationale: `${Math.round(cr * 100)}% access review completion → ${score}` };
      }
      case 'iga-orphan': {
        const orphans = num('orphanCount');
        const total   = num('total', 1);
        const orphanRate = orphans / Math.max(total, 1);
        const score = orphanRate === 0 ? 85 : orphanRate < 0.05 ? 70 : orphanRate < 0.1 ? 50 : orphanRate < 0.2 ? 35 : 15;
        return { score, rationale: `${orphans} orphan accounts (${Math.round(orphanRate * 100)}% rate) → ${score}` };
      }
      case 'iga-roles': {
        const isLive = evidence.some(e => e.quality === 'live');
        const score  = isLive ? 70 : isMock ? 35 : 20;
        return { score, rationale: `SailPoint role engineering: ${isLive ? 'live' : 'mock'} → ${score}` };
      }
      case 'iga-scim': {
        const fromCmdb = rate('scimEnabled', 'total');
        const scimUsers = num('userCount') + num('scimApps');
        const r = Math.max(fromCmdb, scimUsers > 0 ? 0.3 : 0);
        const score = r >= 0.8 ? 85 : r >= 0.5 ? 65 : r >= 0.3 ? 50 : r > 0 ? 35 : 15;
        return { score, rationale: `SCIM coverage rate ~${Math.round(r * 100)}% → ${score}` };
      }

      // ── AM ────────────────────────────────────────────────────────────────
      case 'am-sso': {
        const r = Math.max(rate('ssoEnabled', 'total'), rate('ssoApps', 'total'));
        const score = r >= 0.9 ? 90 : r >= 0.7 ? 75 : r >= 0.5 ? 60 : r >= 0.3 ? 45 : r > 0 ? 30 : 10;
        return { score, rationale: `SSO coverage rate: ${Math.round(r * 100)}% → ${score}` };
      }
      case 'am-mfa': {
        const r = Math.max(rate('mfaRequired', 'total'), rate('mfaApps', 'total'));
        const score = r >= 0.95 ? 95 : r >= 0.8 ? 80 : r >= 0.6 ? 65 : r >= 0.4 ? 50 : r > 0 ? 30 : 10;
        return { score, rationale: `MFA enforcement rate: ${Math.round(r * 100)}% → ${score}` };
      }
      case 'am-ca': {
        const isLive = evidence.some(e => e.quality === 'live');
        const configured = raw('configured');
        const score = isLive ? 75 : configured ? 55 : isMock ? 35 : 15;
        return { score, rationale: `Conditional Access: ${isLive ? 'live-connected' : 'mock'} → ${score}` };
      }
      case 'am-fed': {
        const r = rate('ssoEnabled', 'total');
        const score = r >= 0.8 ? 80 : r >= 0.5 ? 60 : r >= 0.3 ? 45 : r > 0 ? 30 : 15;
        return { score, rationale: `Federated apps: ${Math.round(r * 100)}% → ${score}` };
      }

      // ── PAM ───────────────────────────────────────────────────────────────
      case 'pam-vault': {
        const fromCmdb = rate('pamVaulted', 'total');
        const safes    = num('safeCount');
        const r = Math.max(fromCmdb, safes > 0 ? 0.4 : 0);
        const score = r >= 0.8 ? 85 : r >= 0.6 ? 70 : r >= 0.4 ? 55 : r > 0 ? 40 : 10;
        return { score, rationale: `PAM vault coverage: ${Math.round(r * 100)}%, ${safes} safes → ${score}` };
      }
      case 'pam-rotation': {
        const isLive = evidence.some(e => e.quality === 'live');
        const score  = isLive ? 75 : isMock ? 40 : 15;
        return { score, rationale: `CyberArk rotation: ${isLive ? 'live' : 'mock'} → ${score}` };
      }
      case 'pam-session': {
        const isLive = evidence.some(e => e.quality === 'live');
        const score  = isLive ? 70 : isMock ? 35 : 15;
        return { score, rationale: `Session recording: ${isLive ? 'live' : 'mock'} → ${score}` };
      }
      case 'pam-discovery': {
        const r = rate('pamVaulted', 'total');
        const safes = num('safeCount');
        const score = (r >= 0.7 || safes >= 5) ? 75 : (r >= 0.4 || safes >= 2) ? 55 : safes > 0 ? 40 : 20;
        return { score, rationale: `PAM discovery: ${Math.round(r * 100)}% coverage, ${safes} safes → ${score}` };
      }

      // ── CIAM ──────────────────────────────────────────────────────────────
      case 'ciam-platform': {
        const apps   = num('appCount');
        const isLive = evidence.some(e => e.quality === 'live');
        const score  = apps >= 5 && isLive ? 80 : apps > 0 ? 55 : isLive ? 45 : 20;
        return { score, rationale: `CIAM platform: ${apps} apps, ${isLive ? 'live' : 'mock'} → ${score}` };
      }
      case 'ciam-mfa': {
        const isLive = evidence.some(e => e.quality === 'live');
        const score  = isLive ? 70 : isMock ? 35 : 10;
        return { score, rationale: `CIAM MFA: ${isLive ? 'live' : 'mock'} → ${score}` };
      }
      case 'ciam-pwdless': {
        return { score: 25, rationale: 'Passwordless not yet assessed — mock placeholder → 25' };
      }
      case 'ciam-consent': {
        return { score: 15, rationale: 'Consent management not yet integrated → 15 (Initial)' };
      }

      // ── Lifecycle ─────────────────────────────────────────────────────────
      case 'lc-provision': {
        const scimUsers = num('userCount');
        const spSources = num('sources');
        const isLive    = evidence.some(e => e.quality === 'live');
        const score = (scimUsers > 20 && isLive) ? 75 : scimUsers > 5 ? 60 : spSources > 0 ? 50 : 25;
        return { score, rationale: `Provisioning: ${scimUsers} SCIM users, ${spSources} SP sources → ${score}` };
      }
      case 'lc-deprovision': {
        const scimEvents = num('scimEvents');
        const total      = num('total');
        const cr         = num('completionRate');
        const score = cr >= 0.8 ? 75 : cr >= 0.5 ? 55 : scimEvents > 10 ? 50 : 25;
        return { score, rationale: `Deprovisioning: ${Math.round(cr * 100)}% resolution rate, ${scimEvents} SCIM events → ${score}` };
      }
      case 'lc-workflow': {
        const total = num('total');
        const cr    = num('completionRate');
        const score = total > 50 && cr > 0.8 ? 75 : total > 10 ? 60 : total > 0 ? 45 : 20;
        return { score, rationale: `${total} lifecycle workflows at ${Math.round(cr * 100)}% resolution → ${score}` };
      }
      case 'lc-events': {
        const scimManaged = num('userCount') + num('scimManaged');
        const score = scimManaged > 50 ? 70 : scimManaged > 10 ? 55 : scimManaged > 0 ? 40 : 20;
        return { score, rationale: `${scimManaged} event-driven SCIM managed identities → ${score}` };
      }

      // ── Compliance ────────────────────────────────────────────────────────
      case 'cmp-reviews': {
        const cr = num('completionRate');
        const total = num('total');
        const expired = num('expired');
        const expiredPenalty = total > 0 ? expired / total : 0;
        const base  = cr >= 0.9 ? 85 : cr >= 0.7 ? 65 : cr >= 0.5 ? 50 : cr > 0 ? 35 : 15;
        const score = Math.max(base - Math.round(expiredPenalty * 20), 10);
        return { score, rationale: `${Math.round(cr * 100)}% reviews complete, ${expired} expired → ${score}` };
      }
      case 'cmp-remediation': {
        const rejected = num('rejected');
        const expired  = num('expired');
        const total    = rejected + expired;
        const score = total === 0 ? 30 : rejected >= expired ? 65 : 40;
        return { score, rationale: `${rejected} properly remediated, ${expired} expired without action → ${score}` };
      }
      case 'cmp-controls': {
        const policyCount = num('policyCount');
        const score = policyCount >= 8 ? 80 : policyCount >= 4 ? 65 : policyCount >= 2 ? 45 : policyCount >= 1 ? 30 : 10;
        return { score, rationale: `${policyCount} policy/standard docs as control proxies → ${score}` };
      }
      case 'cmp-audit': {
        const events = num('totalEvents');
        const score  = events >= 500 ? 90 : events >= 100 ? 75 : events >= 20 ? 55 : events > 0 ? 40 : 10;
        return { score, rationale: `${events} audit events captured → ${score}` };
      }

      // ── Documentation ─────────────────────────────────────────────────────
      case 'doc-policies': {
        const published = num('publishedPolicies');
        const inReview  = num('inReview');
        const score = published >= 5 ? 80 : published >= 3 ? 65 : published >= 1 ? 45 : 15;
        return { score, rationale: `${published} published policies (+${inReview} in review) → ${score}` };
      }
      case 'doc-runbooks': {
        const n = num('runbooks');
        const score = n >= 5 ? 80 : n >= 3 ? 65 : n >= 1 ? 45 : 15;
        return { score, rationale: `${n} runbook documents → ${score}` };
      }
      case 'doc-arch': {
        const n = num('arch');
        const score = n >= 3 ? 75 : n >= 1 ? 55 : 15;
        return { score, rationale: `${n} architecture documents → ${score}` };
      }
      case 'doc-review': {
        const inReview = num('inReview');
        const total    = num('total');
        const r = total > 0 ? inReview / total : 0;
        const score = r >= 0.3 ? 75 : r >= 0.15 ? 55 : r > 0 ? 40 : 20;
        return { score, rationale: `${inReview}/${total} documents in active review (${Math.round(r * 100)}%) → ${score}` };
      }

      // ── Service Ops ───────────────────────────────────────────────────────
      case 'svc-sla':        return { score: 45, rationale: 'No live ticketing source — mock default (Developing)' };
      case 'svc-selfservice': {
        const total = num('total');
        const score = total > 100 ? 70 : total > 20 ? 55 : total > 0 ? 40 : 25;
        return { score, rationale: `${total} self-service workflow requests → ${score}` };
      }
      case 'svc-automation': {
        const totalEvents = num('totalEvents');
        const automated   = num('scimEvents') + num('approvalEvents');
        const r = totalEvents > 0 ? automated / totalEvents : 0;
        const score = r >= 0.5 ? 70 : r >= 0.25 ? 55 : r > 0 ? 40 : 25;
        return { score, rationale: `${Math.round(r * 100)}% automated events → ${score}` };
      }
      case 'svc-escalation': return { score: 40, rationale: 'No escalation source — mock default' };

      // ── Build ─────────────────────────────────────────────────────────────
      case 'bld-velocity':  return { score: 50, rationale: 'No live build source — mock default (Defined)' };
      case 'bld-quality':   return { score: 50, rationale: 'No live build source — mock default (Defined)' };
      case 'bld-pipeline':  return { score: 45, rationale: 'CI/CD pipeline maturity not yet assessed — mock default' };
      case 'bld-coverage':  return { score: 50, rationale: 'Delivery coverage not yet measured — mock default' };

      // ── Cost ─────────────────────────────────────────────────────────────
      case 'cst-visibility': {
        const total = num('totalCost');
        const score = total > 0 ? 80 : 20;
        return { score, rationale: `Cost visibility: total $${total.toLocaleString()} → ${score}` };
      }
      case 'cst-vendors': {
        const count   = num('vendorCount');
        const lowEff  = num('lowEfficiency');
        const score   = count === 0 ? 20 : lowEff / count < 0.2 ? 75 : lowEff / count < 0.4 ? 55 : 40;
        return { score, rationale: `${count} vendors, ${lowEff} low-efficiency → ${score}` };
      }
      case 'cst-contracts': {
        const active   = num('active');
        const expiring = num('expiring');
        const total    = num('total', 1);
        const score = total === 0 ? 20 : expiring / total < 0.1 ? 80 : expiring / total < 0.2 ? 65 : 45;
        return { score, rationale: `${active} active contracts, ${expiring} expiring soon → ${score}` };
      }
      case 'cst-roi': return { score: 35, rationale: 'ROI measurement not implemented — initial state' };

      // ── AI & Automation ───────────────────────────────────────────────────
      case 'ai-tools': {
        const connected = num('connected');
        const total     = num('total', 4);
        const score = connected >= 3 ? 75 : connected >= 2 ? 60 : connected >= 1 ? 45 : 20;
        return { score, rationale: `${connected}/${total} IAM platforms live-connected → ${score}` };
      }
      case 'ai-automation': {
        const totalEvents = num('totalEvents');
        const automated   = num('scimEvents') + num('scimManaged') + num('approvalEvents');
        const r = totalEvents > 0 ? automated / totalEvents : 0;
        const score = r >= 0.5 ? 75 : r >= 0.25 ? 60 : r > 0 ? 45 : 20;
        return { score, rationale: `${Math.round(r * 100)}% automated operations → ${score}` };
      }
      case 'ai-anomaly': return { score: 35, rationale: 'Anomaly detection not yet implemented — initial state' };
      case 'ai-predict': return { score: 15, rationale: 'Predictive analytics not yet available — Initial' };

      // ── Security Governance ───────────────────────────────────────────────
      case 'sec-policies': {
        const allows = num('authzAllows');
        const denies = num('authzDenies');
        const total  = allows + denies;
        const score  = total >= 50 ? 80 : total >= 10 ? 65 : total > 0 ? 50 : 20;
        return { score, rationale: `${total} authz events (${allows} allowed, ${denies} denied) → ${score}` };
      }
      case 'sec-sod': {
        const highRisk = num('highRisk');
        const total    = num('total', 1);
        const score    = highRisk > 0 ? 65 : total > 0 ? 50 : 20;
        return { score, rationale: `${highRisk} high-risk requests tracked → ${score}` };
      }
      case 'sec-anomaly': {
        const events = num('totalEvents');
        const denies = num('authzDenies');
        const score  = events >= 100 && denies > 0 ? 60 : events > 0 ? 45 : 20;
        return { score, rationale: `${events} events, ${denies} anomalous denies detected → ${score}` };
      }
      case 'sec-authz': {
        const denies = num('authzDenies');
        const allows = num('authzAllows');
        const total  = denies + allows;
        // Healthy: deny rate exists (policy is enforced), not overwhelming
        const denyRate = total > 0 ? denies / total : 0;
        const score = total === 0 ? 20 : denyRate > 0.5 ? 35 : denyRate > 0.1 ? 65 : denyRate > 0 ? 75 : 40;
        return { score, rationale: `Authz deny rate: ${Math.round(denyRate * 100)}% → ${score}` };
      }

      default:
        return { score: 30, rationale: `No scoring rule for ${id} — default 30` };
    }
  }
}

export const maturityNormalizationService = new MaturityNormalizationService();
