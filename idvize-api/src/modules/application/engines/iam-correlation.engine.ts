import { Application, IamPosture, IamPlatformLink } from '../application.types';
import { entraAdapter } from '../../integration/adapters/entra.adapter';
import { sailpointAdapter } from '../../integration/adapters/sailpoint.adapter';
import { cyberarkAdapter } from '../../integration/adapters/cyberark.adapter';
import { oktaAdapter } from '../../integration/adapters/okta.adapter';

/**
 * IAM Correlation Engine
 *
 * For a given application, queries all IAM platforms and determines:
 * - Which platforms the app is onboarded to
 * - SSO, MFA, SCIM, JML, PAM, Cert status
 * - Missing controls
 * - Risk score
 */
export class IamCorrelationEngine {

  async correlate(app: Application): Promise<IamPosture> {
    // Run all correlations in parallel
    const [entraLink, sailpointLink, cyberarkLink, oktaLink, mfaEnforced, scimEnabled, jmlAutomated, certsConfigured, privilegedVaulted] =
      await Promise.all([
        entraAdapter.correlateApp(app.name),
        sailpointAdapter.correlateApp(app.name),
        cyberarkAdapter.correlateApp(app.name),
        oktaAdapter.correlateApp(app.name),
        entraAdapter.isMfaEnforced(app.name),
        entraAdapter.isScimEnabled(app.name),
        sailpointAdapter.isJmlAutomated(app.name),
        sailpointAdapter.areCertificationsConfigured(app.name),
        cyberarkAdapter.arePrivilegedAccountsVaulted(app.name),
      ]);

    const ssoEnabled = entraLink.onboarded || (oktaLink.onboarded && app.tags.includes('customer-facing'));

    const platforms: IamPlatformLink[] = [entraLink, sailpointLink, cyberarkLink, oktaLink];

    // Determine missing controls
    const missingControls: string[] = [];
    if (!ssoEnabled) missingControls.push('SSO_ENABLED');
    if (!mfaEnforced) missingControls.push('MFA_ENFORCED');
    if (!scimEnabled && sailpointLink.onboarded) missingControls.push('SCIM_PROVISIONING');
    if (!jmlAutomated) missingControls.push('JML_AUTOMATED');
    if (!privilegedVaulted && needsPam(app)) missingControls.push('PRIVILEGED_ACCOUNTS_VAULTED');
    if (!certsConfigured && app.userPopulation > 50) missingControls.push('CERTIFICATIONS_CONFIGURED');

    const riskScore = computeRiskScore(app, missingControls);
    const remediationPriority = deriveRemediationPriority(riskScore, app.riskTier);

    return {
      appId: app.appId,
      ssoEnabled,
      mfaEnforced,
      scimEnabled,
      jmlAutomated,
      privilegedAccountsVaulted: privilegedVaulted,
      certificationsConfigured: certsConfigured,
      platforms,
      riskScore,
      missingControls,
      remediationPriority,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async correlateAll(apps: Application[]): Promise<Map<string, IamPosture>> {
    const results = new Map<string, IamPosture>();
    // Process in batches to avoid hammering APIs
    const batchSize = 10;
    for (let i = 0; i < apps.length; i += batchSize) {
      const batch = apps.slice(i, i + batchSize);
      const postures = await Promise.all(batch.map(app => this.correlate(app)));
      batch.forEach((app, idx) => results.set(app.appId, postures[idx]));
    }
    return results;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function needsPam(app: Application): boolean {
  return (
    app.riskTier === 'critical' &&
    (app.appType === 'on-premise' || app.appType === 'legacy' || app.appType === 'cloud' ||
     app.tags.some(t => ['infrastructure', 'cloud-provider', 'erp', 'finance', 'hr-system'].includes(t)))
  );
}

function computeRiskScore(app: Application, missingControls: string[]): number {
  let score = 0;

  // Base: risk tier
  const tierScore: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10 };
  score += tierScore[app.riskTier] ?? 20;

  // Missing controls penalty
  const controlWeights: Record<string, number> = {
    'SSO_ENABLED': 15,
    'MFA_ENFORCED': 20,
    'SCIM_PROVISIONING': 10,
    'JML_AUTOMATED': 10,
    'PRIVILEGED_ACCOUNTS_VAULTED': 15,
    'CERTIFICATIONS_CONFIGURED': 5,
  };
  for (const control of missingControls) {
    score += controlWeights[control] ?? 5;
  }

  // User population factor
  if (app.userPopulation > 10000) score += 10;
  else if (app.userPopulation > 1000) score += 5;

  return Math.min(score, 100);
}

function deriveRemediationPriority(riskScore: number, riskTier: string): IamPosture['remediationPriority'] {
  if (riskScore >= 80 || riskTier === 'critical') return 'immediate';
  if (riskScore >= 60 || riskTier === 'high') return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

export const iamCorrelationEngine = new IamCorrelationEngine();
