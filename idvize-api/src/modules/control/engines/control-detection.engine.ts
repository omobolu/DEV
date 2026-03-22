import { v4 as uuidv4 } from 'uuid';
import { Control, ControlName, ControlEvaluationResult, ControlStatus, ControlRisk } from '../control.types';
import { Application, IamPosture } from '../../application/application.types';
import { getRequiredControls } from './policy-mapping.engine';

const CONTROL_DESCRIPTIONS: Record<ControlName, { description: string; remediationAction: string }> = {
  SSO_ENABLED: {
    description: 'Single Sign-On is configured, enabling federated authentication via Entra ID, Okta, or equivalent.',
    remediationAction: 'Register application in Entra ID or Okta. Configure SAML 2.0 or OIDC. Test SSO flow.',
  },
  MFA_ENFORCED: {
    description: 'Multi-Factor Authentication is enforced for all users accessing this application.',
    remediationAction: 'Create Conditional Access policy in Entra ID targeting this application. Enforce MFA for all users. Exclude break-glass accounts.',
  },
  SCIM_PROVISIONING: {
    description: 'SCIM 2.0 automated provisioning is configured, enabling automatic user/group sync from the authoritative IGA source.',
    remediationAction: 'Enable SCIM provisioning in Entra ID or SailPoint. Configure attribute mappings. Test provisioning with a pilot group.',
  },
  JML_AUTOMATED: {
    description: 'Joiner-Mover-Leaver lifecycle is automated — accounts are provisioned on hire, updated on role change, and deprovisioned on termination.',
    remediationAction: 'Onboard application as a source or managed target in SailPoint. Configure lifecycle workflows for Joiner, Mover, Leaver events.',
  },
  PRIVILEGED_ACCOUNTS_VAULTED: {
    description: 'All privileged/admin accounts for this application are stored in CyberArk and subject to CPM rotation.',
    remediationAction: 'Create a CyberArk safe for this application. Onboard all privileged accounts. Enable CPM rotation. Remove direct credential access.',
  },
  CERTIFICATIONS_CONFIGURED: {
    description: 'Periodic access certifications (access reviews) are configured to ensure no excess access accumulates.',
    remediationAction: 'Create an access certification campaign in SailPoint targeting this application. Set quarterly review schedule.',
  },
  RBAC_IMPLEMENTED: {
    description: 'Role-Based Access Control is implemented — access is granted through defined roles, not direct entitlements.',
    remediationAction: 'Define application roles in SailPoint or Entra ID groups. Migrate direct entitlements to role-based assignments.',
  },
  CIAM_INTEGRATED: {
    description: 'Customer Identity and Access Management is integrated, managing external user registration, authentication, and consent.',
    remediationAction: 'Integrate application with Okta Customer Identity or Entra External ID. Configure customer registration flows, MFA, and consent management.',
  },
  SESSION_MANAGEMENT: {
    description: 'Session timeouts, session isolation, and concurrent session limits are configured.',
    remediationAction: 'Configure session timeout policies in Entra CA or Okta. Enable CyberArk PSM session isolation for privileged access.',
  },
  AUDIT_LOGGING: {
    description: 'Authentication and authorization events are captured in a centralized SIEM or audit log.',
    remediationAction: 'Enable diagnostic logging in Entra ID. Configure log forwarding to SIEM. Ensure sign-in and audit logs are retained per policy.',
  },
};

const CONTROL_RISK_WEIGHTS: Record<ControlName, ControlRisk> = {
  SSO_ENABLED: 'high',
  MFA_ENFORCED: 'critical',
  SCIM_PROVISIONING: 'medium',
  JML_AUTOMATED: 'high',
  PRIVILEGED_ACCOUNTS_VAULTED: 'critical',
  CERTIFICATIONS_CONFIGURED: 'high',
  RBAC_IMPLEMENTED: 'medium',
  CIAM_INTEGRATED: 'high',
  SESSION_MANAGEMENT: 'medium',
  AUDIT_LOGGING: 'high',
};

/**
 * Control Detection Engine
 *
 * Given an application + its IAM posture (from correlation engine),
 * evaluates all required controls against actual implementation state.
 */
export class ControlDetectionEngine {

  evaluate(app: Application, posture: IamPosture): ControlEvaluationResult {
    const { controls: requiredControls, drivers } = getRequiredControls({
      riskTier: app.riskTier,
      dataClassification: app.dataClassification,
      userPopulation: app.userPopulation,
      appType: app.appType,
      tags: app.tags,
    });

    const controls: Control[] = [];

    for (const controlName of requiredControls) {
      const implemented = isControlImplemented(controlName, posture);
      const expected = true; // All required controls are expected
      const status = deriveStatus(implemented, expected);
      const { description, remediationAction } = CONTROL_DESCRIPTIONS[controlName] ?? {
        description: controlName,
        remediationAction: 'Contact IAM team for guidance.',
      };

      // Find policy drivers relevant to this control
      const controlDrivers = drivers.filter(d =>
        getRequiredControls({ riskTier: app.riskTier, dataClassification: app.dataClassification, userPopulation: app.userPopulation, appType: app.appType, tags: app.tags })
          .controls.includes(controlName)
      );

      controls.push({
        controlId: uuidv4(),
        appId: app.appId,
        controlName,
        description,
        expected,
        implemented,
        status,
        risk: implemented ? 'low' : CONTROL_RISK_WEIGHTS[controlName] ?? 'medium',
        policyDrivers: controlDrivers,
        remediationAction,
        evaluatedAt: new Date().toISOString(),
      });
    }

    const implementedCount = controls.filter(c => c.implemented).length;
    const partialCount = controls.filter(c => c.status === 'partial').length;
    const missingCount = controls.filter(c => !c.implemented).length;

    const riskScore = computeControlRiskScore(controls);

    return {
      appId: app.appId,
      appName: app.name,
      totalControls: controls.length,
      implemented: implementedCount,
      missing: missingCount,
      partial: partialCount,
      riskScore,
      controls,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isControlImplemented(controlName: ControlName, posture: IamPosture): boolean {
  switch (controlName) {
    case 'SSO_ENABLED': return posture.ssoEnabled;
    case 'MFA_ENFORCED': return posture.mfaEnforced;
    case 'SCIM_PROVISIONING': return posture.scimEnabled;
    case 'JML_AUTOMATED': return posture.jmlAutomated;
    case 'PRIVILEGED_ACCOUNTS_VAULTED': return posture.privilegedAccountsVaulted;
    case 'CERTIFICATIONS_CONFIGURED': return posture.certificationsConfigured;
    case 'RBAC_IMPLEMENTED': return posture.platforms.some(p => p.platform === 'IGA' && p.status === 'active');
    case 'CIAM_INTEGRATED': return posture.platforms.some(p => p.platform === 'CIAM' && p.onboarded);
    case 'SESSION_MANAGEMENT': return posture.mfaEnforced; // Proxy: if MFA via CA, session policies likely exist
    case 'AUDIT_LOGGING': return posture.ssoEnabled; // Proxy: federated apps get sign-in logs automatically
    default: return false;
  }
}

function deriveStatus(implemented: boolean, _expected: boolean): ControlStatus {
  if (implemented) return 'implemented';
  return 'not_implemented';
}

function computeControlRiskScore(controls: Control[]): number {
  const weights: Record<ControlRisk, number> = { critical: 25, high: 15, medium: 8, low: 3 };
  let score = 0;
  for (const c of controls) {
    if (!c.implemented) {
      score += weights[c.risk] ?? 5;
    }
  }
  return Math.min(score, 100);
}

export const controlDetectionEngine = new ControlDetectionEngine();
